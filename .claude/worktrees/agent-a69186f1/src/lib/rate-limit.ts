// Phase 6A / P2 — minimal rate-limiting helper.
//
// Scope: this module is the narrowest thing that fits the Phase 6A
// approved scope: four specific hotspots (invitation send, invitation
// accept, onboarding organization create, item import). It is NOT a
// general-purpose limiter, NOT integrated with better-auth, and NOT
// intended to protect the login surface — that is explicitly deferred
// to Phase 6B and will need a different design (edge-runtime-safe,
// keyed on the same IP strategy better-auth uses).
//
// Design
// ------
// We expose a single entry point, `rateLimit(key, limit)`, that:
//
//   1. Takes a caller-chosen scalar key (e.g. `invite:user:<id>`) and
//      a limit object describing the window (`{ max, windowSeconds }`).
//   2. Returns `{ ok, remaining, reset, limit }` where `ok` is a
//      boolean the caller uses to short-circuit, `reset` is a UTC
//      timestamp (seconds) the caller can surface via `Retry-After`
//      or inline error copy, and `remaining` is informational.
//
// Two backends
// ------------
//
//   A. **Upstash Redis REST** (preferred in production). Activated
//      when both `UPSTASH_REDIS_REST_URL` and
//      `UPSTASH_REDIS_REST_TOKEN` are set in the environment.
//      Implements a sliding-window approximation using a single
//      `INCR` against a windowed key with an `EXPIRE` on first
//      insert. We pipeline INCR + EXPIRE through the REST API's
//      `pipeline` endpoint so each rate-limit check costs one HTTP
//      round trip — acceptable for the four low-volume hotspots this
//      module protects (invitations, onboarding, imports). For the
//      login surface and other high-QPS endpoints this will need to
//      be replaced with Upstash's Ratelimit SDK or a token-bucket
//      Lua script, and that is the Phase 6B work we're NOT doing
//      here.
//
//   B. **In-process Map** (dev default / best-effort fallback). A
//      `Map<string, { count, resetAt }>` keyed by `<key>:<window>`.
//      Entirely per-process — a second Next.js lambda instance has
//      its own Map and does its own accounting. We emit a one-shot
//      warning on module load when Upstash credentials are absent so
//      the fallback state is visible in production logs.
//
// Error handling
// --------------
// Both backends treat *unexpected* failures as fail-open: if Redis
// returns a 5xx or the network request throws, we log a warning and
// return `{ ok: true }` with a zero remaining/reset. Rate limiting is
// a defense-in-depth layer for the four hotspots in Phase 6A and
// must not block legitimate invitation sends if Upstash has a blip.
// This matches the "smallest safe diff" rule from the Phase 6A scope
// note and is documented here so the next maintainer doesn't change
// the semantics without thinking through the trade-off.

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export interface RateLimit {
  /**
   * Maximum number of allowed operations per window.
   */
  max: number;
  /**
   * Rolling window duration, in seconds. Implementations round the
   * current time down to the nearest multiple of this value and
   * bucket operations into that slot — this is a fixed-window
   * approximation of a sliding window and is fine for the low-volume
   * hotspots we protect today.
   */
  windowSeconds: number;
}

export interface RateLimitResult {
  /**
   * `true` if the operation is allowed to proceed. Callers should
   * short-circuit with a user-visible error when this is `false`.
   */
  ok: boolean;
  /**
   * How many more operations the key can perform in the current
   * window. Informational — callers may surface this or ignore it.
   */
  remaining: number;
  /**
   * UTC unix-seconds timestamp at which the current window rolls
   * over. Callers emitting HTTP 429 should put `max(0, reset - now)`
   * in the `Retry-After` header.
   */
  reset: number;
  /**
   * Echo of the `max` the caller passed in, so the result object is
   * self-describing for log lines and `X-RateLimit-*` headers.
   */
  limit: number;
}

// --- Backend selection ------------------------------------------------

const upstashUrl = env.UPSTASH_REDIS_REST_URL;
const upstashToken = env.UPSTASH_REDIS_REST_TOKEN;
const hasUpstash = Boolean(upstashUrl && upstashToken);

// Emit a one-shot warning in production when we're falling back to
// in-process. Dev and test environments see this only at `debug`
// level so the dev-loop noise stays low.
if (!hasUpstash) {
  if (env.NODE_ENV === "production") {
    logger.warn(
      "Rate limiter is running in in-process mode; this is NOT safe for multi-instance deployments. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to enable distributed limiting.",
      { tag: "rate-limit.fallback-in-memory" },
    );
  } else {
    logger.debug("In-process rate limiter active (dev default).", {
      tag: "rate-limit.fallback-in-memory",
    });
  }
}

// --- In-process backend -----------------------------------------------

interface MemoryBucket {
  count: number;
  resetAt: number; // unix seconds
}

const memoryBuckets = new Map<string, MemoryBucket>();

// Sweep stale buckets on every write so the Map doesn't grow without
// bound over a long-lived lambda warm period. O(n) over a single
// lambda's active keys, which is a few dozen even in the worst case.
function sweepMemoryBuckets(nowSeconds: number): void {
  for (const [key, bucket] of memoryBuckets) {
    if (bucket.resetAt <= nowSeconds) {
      memoryBuckets.delete(key);
    }
  }
}

function checkMemory(bucketKey: string, limit: RateLimit): RateLimitResult {
  const nowSeconds = Math.floor(Date.now() / 1000);
  sweepMemoryBuckets(nowSeconds);

  const bucket = memoryBuckets.get(bucketKey);
  if (!bucket || bucket.resetAt <= nowSeconds) {
    const resetAt = nowSeconds + limit.windowSeconds;
    memoryBuckets.set(bucketKey, { count: 1, resetAt });
    return { ok: true, remaining: limit.max - 1, reset: resetAt, limit: limit.max };
  }

  if (bucket.count >= limit.max) {
    return { ok: false, remaining: 0, reset: bucket.resetAt, limit: limit.max };
  }

  bucket.count += 1;
  return {
    ok: true,
    remaining: Math.max(0, limit.max - bucket.count),
    reset: bucket.resetAt,
    limit: limit.max,
  };
}

// --- Upstash REST backend ---------------------------------------------

// Upstash pipeline REST shape:
//   POST /pipeline { commands: [[cmd, ...args], ...] }
// Response: [{ result: ... }, { result: ... }]
//
// We pipeline INCR + EXPIRE so the EXPIRE only sets a TTL when we're
// sure the key exists. Upstash returns INCR as a number and EXPIRE
// as 0 or 1; we only care about the INCR result for the decision and
// tolerate EXPIRE returning 0 on subsequent calls within the same
// window.
async function checkUpstash(bucketKey: string, limit: RateLimit): Promise<RateLimitResult> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const windowStart = nowSeconds - (nowSeconds % limit.windowSeconds);
  const windowEnd = windowStart + limit.windowSeconds;
  const windowedKey = `rl:${bucketKey}:${windowStart}`;

  try {
    const response = await fetch(`${upstashUrl}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${upstashToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", windowedKey],
        ["EXPIRE", windowedKey, String(limit.windowSeconds)],
      ]),
      // No caching. Next.js aggressively caches fetch() by default on
      // the server, and we absolutely do not want rate-limit checks
      // to be cached.
      cache: "no-store",
    });

    if (!response.ok) {
      logger.warn("Upstash REST returned non-2xx; failing open", {
        tag: "rate-limit.upstash-http",
        status: response.status,
      });
      return { ok: true, remaining: limit.max, reset: windowEnd, limit: limit.max };
    }

    const body = (await response.json()) as Array<{ result: unknown }>;
    const incrResult = body[0]?.result;
    const count = typeof incrResult === "number" ? incrResult : Number(incrResult);
    if (!Number.isFinite(count)) {
      logger.warn("Could not parse INCR result; failing open", {
        tag: "rate-limit.upstash-parse",
        incrResult,
      });
      return { ok: true, remaining: limit.max, reset: windowEnd, limit: limit.max };
    }

    if (count > limit.max) {
      return { ok: false, remaining: 0, reset: windowEnd, limit: limit.max };
    }

    return {
      ok: true,
      remaining: Math.max(0, limit.max - count),
      reset: windowEnd,
      limit: limit.max,
    };
  } catch (err) {
    // Fail-open on network errors. See the module-level comment about
    // the deliberate trade-off.
    logger.warn("Upstash REST threw; failing open", {
      tag: "rate-limit.upstash-error",
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: true, remaining: limit.max, reset: windowEnd, limit: limit.max };
  }
}

// --- Public entry point -----------------------------------------------

/**
 * Check a rate-limit bucket. Returns `{ ok: false }` if the caller
 * has exceeded `limit.max` operations within the current
 * `limit.windowSeconds` window.
 *
 * `key` must encode every dimension the caller wants to segregate on:
 *
 *   rateLimit(`invite:send:user:${userId}`, { max: 5, windowSeconds: 60 });
 *   rateLimit(`invite:send:org:${orgId}`,   { max: 20, windowSeconds: 3600 });
 *
 * The convention is `<action>:<dimension>:<id>`. There is no helper
 * for key construction on purpose — forcing the caller to spell out
 * the key at the call site makes rate-limit rules greppable and
 * auditable.
 */
export async function rateLimit(key: string, limit: RateLimit): Promise<RateLimitResult> {
  if (hasUpstash) {
    return checkUpstash(key, limit);
  }
  return checkMemory(key, limit);
}

/**
 * Testing helper — clears the in-process bucket map. Intended for
 * unit-test teardown only; a no-op against the Upstash backend
 * because tests should stub fetch directly if they need to exercise
 * the Redis path.
 */
export function __resetMemoryBucketsForTest(): void {
  memoryBuckets.clear();
}
