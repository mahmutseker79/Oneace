// src/lib/idempotency/middleware.ts
//
// GOD MODE roadmap 2026-04-23 — P0-02.
//
// `withIdempotency(cfg, fn)` — request-level deduplication for
// critical write actions. Wraps any async function so that:
//
//   - A replay (same key + same payload) returns the cached result
//     instead of re-running the function. Protects against double
//     ship / double receive / double kit assemble on network retry.
//
//   - A replay with a mismatched payload throws
//     `IdempotencyConflictError`. Caller maps this to an HTTP 409 /
//     ActionResult with `ok: false`. This catches "same key, different
//     body" programmer errors and fraud.
//
//   - A concurrent second request with the same key (the first is
//     still IN_FLIGHT) throws `IdempotencyInProgressError`. Caller
//     maps this to an HTTP 409 / retry-with-backoff. Prevents two
//     concurrent workers from both running the critical section.
//
//   - A previous failure (state='FAILED') is rerun on the next
//     request. Failures are NOT cached.
//
// Key surface:
//   `key` is the user-supplied idempotency token. Suggested sources:
//     - UI:      a UUID minted per form mount.
//     - Webhook: deterministic derivation, e.g. `wh:${provider}:${deliveryId}`.
//   `actionName` is a constant per call site, e.g. `"shipSalesOrder"`.
//   The pair (orgId, sha256(`${actionName}:${key}`)) is the unique row.
//
// Pass-through path:
//   If `key` is null/empty the middleware does NOT insert a row and
//   just runs `fn` once. This makes roll-out safe: a caller that has
//   not yet been updated to supply a key behaves exactly as before.
//   Legacy rows with null keys are tracked by the schema's nullable
//   column on StockMovement (P0-03 will make that column NOT NULL).
//
// What this is NOT:
//   - Not a distributed lock (no Redis, no lease). The IN_FLIGHT
//     state gives us single-process dedup via the unique index; two
//     concurrent requests converge to 409-for-one via the insert
//     uniqueness violation.
//   - Not a caching layer for general reads. Only idempotency for
//     WRITES.
//   - Not a retry queue. That's `src/lib/integrations/task-queue.ts`.

import { createHash } from "node:crypto";

import { Prisma, type PrismaClient } from "@/generated/prisma";

import { db as defaultDb } from "@/lib/db";

export class IdempotencyConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IdempotencyConflictError";
  }
}

export class IdempotencyInProgressError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IdempotencyInProgressError";
  }
}

export interface IdempotencyConfig {
  /** Tenant scope. Required. */
  organizationId: string;
  /** Dotted identifier per call site, e.g. "shipSalesOrder". Required. */
  actionName: string;
  /**
   * The user-supplied idempotency token. If null / empty / undefined,
   * the middleware runs `fn` once with NO caching. This is the
   * roll-out escape hatch — a caller upgraded after its peers still
   * behaves correctly.
   */
  key: string | null | undefined;
  /**
   * The request payload. Fingerprinted to detect "same key, different
   * body". MUST be JSON-serializable. Order of object keys does NOT
   * matter (canonicalized before hashing).
   */
  payload: unknown;
  /** TTL in ms. Defaults to 24h. */
  ttlMs?: number;
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Prisma client fragment we depend on. Kept narrow so tests can stub
 * with a fake object rather than pulling the full Prisma client graph.
 */
export type IdempotencyDbClient = Pick<PrismaClient, "idempotencyKey">;

function sha256Hex(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/**
 * Canonical JSON: recursively sort object keys and drop `undefined`
 * values so that two structurally equivalent payloads produce the same
 * string (and therefore the same fingerprint). Arrays keep their
 * order (semantics).
 */
function canonicalize(v: unknown): string {
  const sort = (x: unknown): unknown => {
    if (x === null || x === undefined) return null;
    if (typeof x !== "object") return x;
    if (Array.isArray(x)) return x.map(sort);
    const o = x as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(o).sort()) {
      const val = o[k];
      if (val === undefined) continue;
      out[k] = sort(val);
    }
    return out;
  };
  return JSON.stringify(sort(v));
}

/** Internal: compose the hash used in the unique index. */
export function deriveKeyHash(actionName: string, key: string): string {
  return sha256Hex(`${actionName}:${key}`);
}

/** Internal: fingerprint the request payload. */
export function derivePayloadFingerprint(payload: unknown): string {
  return sha256Hex(canonicalize(payload));
}

/**
 * The wrapper. Call sites look like:
 *
 *   return withIdempotency(
 *     { organizationId: orgId, actionName: "shipSalesOrder", key: input.idempotencyKey, payload: input },
 *     async () => shipSalesOrderImpl(input),
 *   );
 *
 * Optional `db` parameter is for tests; production code uses the default.
 */
export async function withIdempotency<T>(
  cfg: IdempotencyConfig,
  fn: () => Promise<T>,
  db: IdempotencyDbClient = defaultDb,
): Promise<T> {
  // Invariants.
  if (!cfg.organizationId || cfg.organizationId.trim() === "") {
    throw new Error("withIdempotency: organizationId is required");
  }
  if (!cfg.actionName || cfg.actionName.trim() === "") {
    throw new Error("withIdempotency: actionName is required");
  }

  // Roll-out escape hatch: no key → pass-through (no caching).
  if (!cfg.key || cfg.key.trim() === "") {
    return fn();
  }

  const keyHash = deriveKeyHash(cfg.actionName, cfg.key);
  const fingerprint = derivePayloadFingerprint(cfg.payload);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + (cfg.ttlMs ?? DEFAULT_TTL_MS));

  // Look up the existing row, if any. An expired row is treated as if
  // it does not exist — we'll re-run and upsert below.
  const existing = await db.idempotencyKey.findUnique({
    where: {
      organizationId_keyHash: {
        organizationId: cfg.organizationId,
        keyHash,
      },
    },
  });

  if (existing && existing.expiresAt > now) {
    if (existing.state === "COMPLETED") {
      if (existing.requestFingerprint !== fingerprint) {
        throw new IdempotencyConflictError(
          `Idempotency key reused with different payload for action "${cfg.actionName}".`,
        );
      }
      // Cached happy path. The responseJson is typed as Json in
      // Prisma, so we cast on the way out. Callers should not store
      // non-JSON-serializable values in `T`.
      return existing.responseJson as T;
    }
    if (existing.state === "IN_FLIGHT") {
      throw new IdempotencyInProgressError(
        `A concurrent request with the same idempotency key is still running for action "${cfg.actionName}".`,
      );
    }
    // state === "FAILED" → fall through to re-run.
  }

  // Upsert to IN_FLIGHT. `upsert` handles both the "first time" and
  // "previously FAILED / expired" cases in one round trip. The
  // `create` branch relies on the (orgId, keyHash) unique index to
  // serialize two concurrent "first time" requests — one will win,
  // the loser sees the unique-violation + our outer code maps it to
  // IdempotencyInProgressError on the next read.
  try {
    await db.idempotencyKey.upsert({
      where: {
        organizationId_keyHash: {
          organizationId: cfg.organizationId,
          keyHash,
        },
      },
      create: {
        organizationId: cfg.organizationId,
        keyHash,
        actionName: cfg.actionName,
        requestFingerprint: fingerprint,
        state: "IN_FLIGHT",
        expiresAt,
      },
      update: {
        actionName: cfg.actionName,
        requestFingerprint: fingerprint,
        state: "IN_FLIGHT",
        responseJson: Prisma.DbNull as unknown as Prisma.InputJsonValue,
        completedAt: null,
        expiresAt,
      },
    });
  } catch (err) {
    // Unique-violation race: another worker won the `create` path.
    // Treat as IN_FLIGHT from our perspective.
    const code = (err as { code?: string } | null)?.code;
    if (code === "P2002") {
      throw new IdempotencyInProgressError(
        `A concurrent request with the same idempotency key is racing for action "${cfg.actionName}".`,
      );
    }
    throw err;
  }

  // Run the body. On success, cache the response; on failure, mark
  // FAILED so a subsequent retry can try again (the current caller
  // still sees the error rethrown).
  try {
    const result = await fn();
    await db.idempotencyKey.update({
      where: {
        organizationId_keyHash: {
          organizationId: cfg.organizationId,
          keyHash,
        },
      },
      data: {
        state: "COMPLETED",
        responseJson: (result ?? null) as unknown as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });
    return result;
  } catch (err) {
    // Best-effort FAILED write. We don't want a logging hiccup to
    // mask the real error — `update` can throw if the DB is down, in
    // which case letting the original error win is the right move.
    try {
      await db.idempotencyKey.update({
        where: {
          organizationId_keyHash: {
            organizationId: cfg.organizationId,
            keyHash,
          },
        },
        data: { state: "FAILED", completedAt: new Date() },
      });
    } catch {
      /* swallow — original error wins */
    }
    throw err;
  }
}
