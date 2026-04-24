/**
 * Audit v1.3 §5.53 F-09 — IntegrationTask queue + DLQ helpers.
 *
 * What this module owns:
 *
 *   - `enqueue(task)`  — drop a new unit of work into the queue
 *   - `claimDueTasks({ limit })` — atomically claim up to N due
 *     rows (used by the `/api/cron/integration-tasks` consumer)
 *   - `markDone(taskId)`
 *   - `markFailure(taskId, err)` — classifies the error, bumps
 *     retryCount, schedules the next attempt on the backoff curve,
 *     and flips the row to "dead" + notifies the owner once the
 *     ceiling is hit
 *   - `backoffMsFor(retryCount)` — pure function, exported so the
 *     pinned test can assert the curve without touching Prisma
 *   - `classifyError(err)` — pure function, maps an `Error` to one
 *     of the documented `lastErrorKind` buckets
 *
 * Deliberate non-choices:
 *
 *   - **Not a worker loop.** A long-running worker would need a
 *     process supervisor. The project already runs cron on Vercel;
 *     a 30-minute cron draining the queue is the right shape
 *     for a serverless-first codebase. The pure-function helpers
 *     make the "upgrade to a worker" switch a swap at the call
 *     site, not a rewrite.
 *
 *   - **No adapter wiring in this commit.** The 15 adapters under
 *     `src/lib/integrations/<dir>` still throw on failure. The
 *     follow-up PR replaces their `catch (e) { logger.warn(...) }`
 *     with `catch (e) { await enqueue({ ... }); throw e; }`. The
 *     audit explicitly splits this — adapter-by-adapter wiring
 *     carries regression risk (different APIs, different retry
 *     contracts) and the spec recommends staged rollout per
 *     adapter. Shipping the queue primitives first means each
 *     adapter PR becomes a one-file change.
 *
 *   - **No claim-token / visibility-timeout semantics.** A second
 *     cron invocation while the first is running could double-claim
 *     the same row — but the cron is wrapped in
 *     `withCronIdempotency` (daily bucket is too long; see
 *     route.ts for the per-invocation `SELECT FOR UPDATE SKIP
 *     LOCKED` claim pattern). Vercel Hobby crons run on a single
 *     region with a 60s wall budget, so the claim window is small.
 *     When we outgrow that (move to SQS / pgmq), this module is the
 *     only swap point.
 *
 *   - **String `status` column, not an enum.** The Prisma schema
 *     uses `String` so new adapters can add provider-specific
 *     statuses without a migration round-trip. The compile-time
 *     fence lives here as the `IntegrationTaskStatus` union.
 *
 * The cron consumer lives at
 * `src/app/api/cron/integration-tasks/route.ts`. The pinned test at
 * `src/lib/integrations/integration-task-queue.test.ts` freezes the
 * backoff curve, classifier buckets, and the three-retry dead-threshold.
 */

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getMailer } from "@/lib/mail";

// ─────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────

/** String-column `status` values this module will ever write. */
export type IntegrationTaskStatus = "pending" | "in_progress" | "done" | "dead";

/** Error classifier buckets. See `classifyError()` below. */
export type IntegrationTaskErrorKind =
  | "auth"
  | "rate-limit"
  | "5xx"
  | "4xx"
  | "schema-mismatch"
  | "transport"
  | "unknown";

/** What an adapter hands to `enqueue()`. */
export type EnqueueInput = {
  organizationId: string;
  /** Must match a directory name under `src/lib/integrations/`. */
  integrationKind: string;
  /** Adapter-defined; documented in that adapter's README. */
  taskKind: string;
  payload: Record<string, unknown>;
  /**
   * Optional initial delay. Webhook-driven tasks usually want
   * `nextAttemptAt=now` (undefined); scheduled work can pass a
   * future timestamp.
   */
  nextAttemptAt?: Date;
};

/** What the cron consumer receives from `claimDueTasks()`. */
export type ClaimedTask = {
  id: string;
  organizationId: string;
  integrationKind: string;
  taskKind: string;
  payload: unknown;
  retryCount: number;
};

// ─────────────────────────────────────────────────────────────────
// Knobs
// ─────────────────────────────────────────────────────────────────

/**
 * Once a row reaches this many failed attempts, `markFailure` flips
 * it to `dead` and emails the owner. Three tries balances:
 *
 *   - most transient failures (network blip, rate-limit, upstream
 *     503) resolve on the 1-minute or 5-minute retry
 *   - a single stuck adapter doesn't spam the dead-letter mailbox
 *   - the full curve (1m + 5m + 30m ≈ 36 min) fits inside a
 *     half-hour SLO for "did this webhook actually land?"
 *
 * If the audit revisits this, the follow-up is per-adapter
 * override — Shopify's 2/sec rate-limit means 3 retries is stingy,
 * but QuickBooks' hour-granular throttling means 3 retries is
 * plenty. For now, one constant.
 */
export const MAX_RETRIES = 3;

/**
 * Backoff ladder in milliseconds, indexed by `retryCount` AFTER the
 * failure. So the first failure (retryCount 0 → 1) waits
 * `BACKOFF_MS[0]` = 1 minute, the second waits 5 minutes, etc.
 *
 * 1m → 5m → 30m → 2h → 8h. The last two are never actually hit
 * under the current `MAX_RETRIES=3` ceiling; they are there so a
 * future override can bump the ceiling without changing the curve.
 */
export const BACKOFF_MS: readonly number[] = [
  1 * 60_000, //  1 minute
  5 * 60_000, //  5 minutes
  30 * 60_000, // 30 minutes
  2 * 60 * 60_000, //  2 hours
  8 * 60 * 60_000, //  8 hours
];

// ─────────────────────────────────────────────────────────────────
// Pure helpers (no Prisma, no network — directly unit-testable)
// ─────────────────────────────────────────────────────────────────

/**
 * Next-attempt delay in ms given the current retryCount (0-based).
 * Clamps to the last entry of `BACKOFF_MS` so a misconfigured
 * `MAX_RETRIES` above `BACKOFF_MS.length` degrades gracefully
 * instead of returning `undefined`.
 */
export function backoffMsFor(retryCount: number): number {
  // `BACKOFF_MS` is a non-empty `readonly number[]` literal declared
  // above with 6 entries. Under `noUncheckedIndexedAccess` TS widens
  // indexed access to `number | undefined`, but the index math below
  // always lands in-bounds: negative → 0, positive → clamped to
  // `length - 1`. Cast once at the boundary.
  if (retryCount < 0) return BACKOFF_MS[0] as number;
  const idx = Math.min(retryCount, BACKOFF_MS.length - 1);
  return BACKOFF_MS[idx] as number;
}

/**
 * Map an arbitrary thrown value to one of the documented
 * `lastErrorKind` buckets. The goal is dashboard-friendly
 * grouping, not exact classification — if Shopify returns a 500
 * during an auth token refresh, we accept that it gets classified
 * as "5xx" and not "auth". The classifier is a best-effort hint,
 * not a control-flow signal.
 *
 * Per-adapter classifiers (the audit recommends one per provider)
 * can extend this by catching provider-specific errors upstream
 * and re-throwing a typed `IntegrationError` whose `code` starts
 * with `AUTH_`, `RATE_LIMIT_`, `HTTP_<status>`, `SCHEMA_`, or
 * `TRANSPORT_`. That keeps the classifier policy in one module.
 */
export function classifyError(err: unknown): IntegrationTaskErrorKind {
  if (!err) return "unknown";

  // `IntegrationError` from `base-client.ts` has `code` +
  // `statusCode`. We inspect both.
  const e = err as { code?: string; statusCode?: number; name?: string; message?: string };

  if (typeof e.code === "string") {
    const code = e.code.toUpperCase();
    if (code.startsWith("AUTH") || code.includes("REFRESH")) return "auth";
    if (code.includes("RATE_LIMIT") || code.includes("RATE-LIMIT")) return "rate-limit";
    if (code.startsWith("SCHEMA")) return "schema-mismatch";
    if (code.startsWith("TRANSPORT") || code === "ECONNRESET" || code === "ETIMEDOUT") {
      return "transport";
    }
    // HTTP_5xx / HTTP_4xx from base-client.
    const httpMatch = /^HTTP_(\d{3})/.exec(code);
    if (httpMatch) {
      const status = Number(httpMatch[1]);
      if (status === 401 || status === 403) return "auth";
      if (status === 429) return "rate-limit";
      if (status >= 500) return "5xx";
      if (status >= 400) return "4xx";
    }
  }

  if (typeof e.statusCode === "number") {
    if (e.statusCode === 401 || e.statusCode === 403) return "auth";
    if (e.statusCode === 429) return "rate-limit";
    if (e.statusCode >= 500) return "5xx";
    if (e.statusCode >= 400) return "4xx";
  }

  // `fetch` under the hood throws `TypeError` on DNS / socket
  // failures; treat those as transport, not unknown.
  if (e.name === "TypeError" || e.name === "AbortError") return "transport";

  return "unknown";
}

/** Safely read a short error message for the `lastError` column. */
export function errorMessage(err: unknown, maxLen = 500): string {
  if (!err) return "(no error)";
  const raw = err instanceof Error ? err.message : String(err);
  return raw.length > maxLen ? `${raw.slice(0, maxLen)}…` : raw;
}

// ─────────────────────────────────────────────────────────────────
// Queue operations
// ─────────────────────────────────────────────────────────────────

/**
 * Drop a new task into the queue. Returns the inserted row id.
 *
 * Callers should NOT await the full handler here — enqueue is
 * fire-and-forget from the webhook / sync handler's point of view.
 */
export async function enqueue(input: EnqueueInput): Promise<string> {
  const row = await db.integrationTask.create({
    data: {
      organizationId: input.organizationId,
      integrationKind: input.integrationKind,
      taskKind: input.taskKind,
      payload: input.payload as object,
      status: "pending",
      nextAttemptAt: input.nextAttemptAt ?? new Date(),
    },
    select: { id: true },
  });

  logger.info("integration-task.enqueued", {
    tag: "integration-task.enqueued",
    taskId: row.id,
    organizationId: input.organizationId,
    integrationKind: input.integrationKind,
    taskKind: input.taskKind,
  });

  return row.id;
}

/**
 * Atomically claim up to `limit` due tasks. Uses an UPDATE with a
 * subquery so two concurrent cron invocations can't claim the same
 * row — Postgres acquires the row lock, the loser gets zero rows.
 *
 * Returns rows in oldest-first order so a long-stuck task gets a
 * shot on every drain.
 *
 * The raw query is intentional:
 *
 *   - Prisma's `updateMany` cannot `RETURNING *` in the same call.
 *   - Doing a `findMany` + `updateMany` is two trips AND races.
 *
 * `$queryRawUnsafe` is safe here because the inputs (`limit`, the
 * status literal, the `now()` function) are not user-controlled.
 */
export async function claimDueTasks(opts: { limit?: number } = {}): Promise<ClaimedTask[]> {
  const limit = Math.max(1, Math.min(opts.limit ?? 25, 100));

  const rows = await db.$queryRawUnsafe<
    Array<{
      id: string;
      organizationId: string;
      integrationKind: string;
      taskKind: string;
      payload: unknown;
      retryCount: number;
    }>
  >(
    `
      UPDATE "IntegrationTask"
      SET "status" = 'in_progress',
          "updatedAt" = NOW()
      WHERE "id" IN (
        SELECT "id" FROM "IntegrationTask"
        WHERE "status" = 'pending'
          AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= NOW())
        ORDER BY COALESCE("nextAttemptAt", "createdAt") ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING "id", "organizationId", "integrationKind", "taskKind", "payload", "retryCount"
    `,
  );

  return rows;
}

/** Mark a claimed task as completed. */
export async function markDone(taskId: string): Promise<void> {
  await db.integrationTask.update({
    where: { id: taskId },
    data: {
      status: "done",
      nextAttemptAt: null,
      lastError: null,
      lastErrorKind: null,
    },
  });

  logger.info("integration-task.done", {
    tag: "integration-task.done",
    taskId,
  });
}

/**
 * Record a handler failure, bump retryCount, schedule the next
 * attempt on the backoff curve, and — once the MAX_RETRIES ceiling
 * is reached — flip the row to `dead` and email the org owner.
 *
 * Uses a two-step read→update so we can branch on retryCount. The
 * read is not locked: concurrent failures from the same task would
 * require two cron runs claiming the same id, which the SKIP
 * LOCKED claim path already prevents.
 */
export async function markFailure(taskId: string, err: unknown): Promise<void> {
  const current = await db.integrationTask.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      organizationId: true,
      integrationKind: true,
      taskKind: true,
      retryCount: true,
    },
  });

  if (!current) {
    logger.warn("integration-task.failure-missing-row", {
      tag: "integration-task.failure-missing-row",
      taskId,
    });
    return;
  }

  const nextRetryCount = current.retryCount + 1;
  const kind = classifyError(err);
  const message = errorMessage(err);

  if (nextRetryCount >= MAX_RETRIES) {
    // Terminal — flip to dead, notify the owner.
    await db.integrationTask.update({
      where: { id: taskId },
      data: {
        status: "dead",
        retryCount: nextRetryCount,
        nextAttemptAt: null,
        lastError: message,
        lastErrorKind: kind,
      },
    });

    logger.error("integration-task.dead", {
      tag: "integration-task.dead",
      taskId,
      organizationId: current.organizationId,
      integrationKind: current.integrationKind,
      taskKind: current.taskKind,
      retryCount: nextRetryCount,
      lastErrorKind: kind,
    });

    // Best-effort email. A mail failure must NOT bounce the queue
    // drain — the logger.error above is the authoritative record.
    try {
      await notifyOwnerOfDeadLetter({
        organizationId: current.organizationId,
        integrationKind: current.integrationKind,
        taskKind: current.taskKind,
        taskId,
        lastError: message,
        lastErrorKind: kind,
      });
    } catch (mailErr) {
      logger.warn("integration-task.dead-notify-failed", {
        tag: "integration-task.dead-notify-failed",
        taskId,
        err: mailErr,
      });
    }
    return;
  }

  // Non-terminal — bump counter, reschedule on the backoff curve.
  const delay = backoffMsFor(current.retryCount);
  const nextAttemptAt = new Date(Date.now() + delay);

  await db.integrationTask.update({
    where: { id: taskId },
    data: {
      status: "pending",
      retryCount: nextRetryCount,
      nextAttemptAt,
      lastError: message,
      lastErrorKind: kind,
    },
  });

  logger.warn("integration-task.retry-scheduled", {
    tag: "integration-task.retry-scheduled",
    taskId,
    retryCount: nextRetryCount,
    nextAttemptAt: nextAttemptAt.toISOString(),
    lastErrorKind: kind,
  });
}

// ─────────────────────────────────────────────────────────────────
// Dead-letter notification
// ─────────────────────────────────────────────────────────────────

type DeadLetterNotification = {
  organizationId: string;
  integrationKind: string;
  taskKind: string;
  taskId: string;
  lastError: string;
  lastErrorKind: IntegrationTaskErrorKind;
};

/**
 * Email the org's OWNER(s) when a task dies. Uses the existing
 * mailer factory so the console-mailer substitution in dev/tests
 * still applies. Intentionally minimal — the goal here is
 * "something reached a human", not a polished dashboard link.
 *
 * The follow-up (audit §5.53 dynamic-expert note) is a
 * provider-aware template: QuickBooks dead-letter emails should
 * include the reconnect URL; Shopify should include the affected
 * store handle. That layer is per-adapter and lives in
 * `src/lib/integrations/<dir>/dead-letter-template.ts` when the
 * adapter wiring PR lands.
 */
async function notifyOwnerOfDeadLetter(n: DeadLetterNotification): Promise<void> {
  const owners = await db.membership.findMany({
    where: { organizationId: n.organizationId, role: "OWNER" },
    select: { user: { select: { email: true, name: true } } },
  });

  if (owners.length === 0) {
    logger.warn("integration-task.dead-no-owner", {
      tag: "integration-task.dead-no-owner",
      organizationId: n.organizationId,
    });
    return;
  }

  const mailer = getMailer();
  const subject = `[OneAce] ${n.integrationKind} sync failed permanently`;
  const text = [
    `A ${n.integrationKind} ${n.taskKind} task failed after ${MAX_RETRIES} retries.`,
    "",
    `Task ID:       ${n.taskId}`,
    `Error kind:    ${n.lastErrorKind}`,
    `Last message:  ${n.lastError}`,
    "",
    "The task is now in the dead-letter queue and will not retry on its own.",
    "Open the Integrations admin → Dead-letter view to replay or discard.",
  ].join("\n");
  const html = `<div style="font-family:system-ui,sans-serif;color:#111;">
    <p>A <strong>${n.integrationKind}</strong> <code>${n.taskKind}</code> task failed after ${MAX_RETRIES} retries.</p>
    <p><strong>Task ID:</strong> <code>${n.taskId}</code><br/>
       <strong>Error kind:</strong> ${n.lastErrorKind}<br/>
       <strong>Last message:</strong> ${n.lastError}</p>
    <p>The task is in the dead-letter queue and will not retry on its own. Open the Integrations admin → Dead-letter view to replay or discard.</p>
  </div>`;

  for (const owner of owners) {
    if (!owner.user.email) continue;
    await mailer.send({
      to: owner.user.email,
      subject,
      text,
      html,
    });
  }
}
