/**
 * Audit v1.1 §5.27 — cron idempotency guard.
 *
 * Vercel Cron's default delivery is at-least-once: if the handler returns
 * 5xx or exceeds the function timeout, Vercel retries. Before this helper
 * landed, a retried invocation of `stock-count-triggers` could have fired
 * a second pass of count templates for the same day, and a retried
 * `cleanup-migration-files` could have attempted a second delete of the
 * same blob keys (mostly idempotent at the blob store, but the audit log
 * would show duplicate events).
 *
 * The contract here is deliberately narrow:
 *
 *   1. Build a deterministic run id from `cron:<name>:<UTC-day>`. UTC is
 *      used because Vercel Cron schedules are UTC — anything else would
 *      break during DST transitions at the user's locale.
 *   2. Upsert into `CronRun`. If the row already exists AND has a
 *      non-null `completedAt`, short-circuit: the job already finished
 *      today, return `{ skipped: true }`. If the row exists but
 *      `completedAt` is still null, the handler assumes the previous run
 *      crashed mid-flight — we re-run (fail-forward is safer than
 *      silently skipping a half-finished job).
 *   3. Run the caller's `fn`. On success, set `completedAt` + `result`.
 *      On failure, store the truncated error message and rethrow so the
 *      route handler's catch can still log + return 500.
 *
 * This helper is NOT a distributed lock. Two concurrent cron invocations
 * reaching step 2 at the same millisecond will both write their upsert
 * and both proceed to step 3. That's fine for Vercel Cron (only one
 * invocation per schedule tick is dispatched) and we don't use it for
 * sub-minute schedules. If that ever changes, upgrade this helper to a
 * conditional insert (SELECT … FOR UPDATE or an advisory lock) — DO NOT
 * just tighten the upsert shape, because Prisma upsert is two statements
 * under the hood and the gap between them is the race window.
 */

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

/** Bucket the timestamp to a UTC day — matches the Vercel Cron schedule clock. */
function utcDayBucket(at: Date): string {
  return at.toISOString().slice(0, 10);
}

function buildRunId(name: string, at: Date): string {
  return `cron:${name}:${utcDayBucket(at)}`;
}

/** Truncate long error messages so we don't blow up the `error` column. */
function truncateError(err: unknown, max = 2000): string {
  const msg = err instanceof Error ? err.stack ?? err.message : String(err);
  return msg.length > max ? `${msg.slice(0, max)}… [truncated]` : msg;
}

export type CronIdempotencyResult<T> =
  | { skipped: true; runId: string; completedAt: Date }
  | { skipped: false; runId: string; result: T };

/**
 * Wrap a cron job body so that at most one successful run per UTC day
 * is recorded. Returns `{ skipped: true }` if today's run already
 * completed. On first run of the day, returns `{ skipped: false, result }`.
 *
 * Usage in a route:
 *
 *   const outcome = await withCronIdempotency("stock-count-triggers", async () => {
 *     // ... actual job body ...
 *     return { triggered: 5 };
 *   });
 *   if (outcome.skipped) return NextResponse.json({ ok: true, skipped: true });
 *   return NextResponse.json({ ok: true, ...outcome.result });
 *
 * The caller keeps control of the HTTP response shape so we don't lock
 * downstream consumers into a particular JSON envelope.
 */
export async function withCronIdempotency<T>(
  name: string,
  fn: () => Promise<T>,
  opts: { now?: Date } = {},
): Promise<CronIdempotencyResult<T>> {
  const now = opts.now ?? new Date();
  const runId = buildRunId(name, now);

  // Step 1 — upsert. If a prior run of this UTC-day already finished,
  // its row will have completedAt != null and we short-circuit.
  const row = await db.cronRun.upsert({
    where: { runId },
    create: { runId, name, startedAt: now },
    update: {}, // don't clobber startedAt / completedAt on re-entry
  });

  if (row.completedAt) {
    logger.info("cron idempotency: already ran today, skipping", {
      tag: "cron.idempotency",
      name,
      runId,
      completedAt: row.completedAt,
    });
    return { skipped: true, runId, completedAt: row.completedAt };
  }

  // Step 2 — run the body. Catch to stamp `error`, then rethrow.
  try {
    const result = await fn();
    await db.cronRun.update({
      where: { runId },
      data: {
        completedAt: new Date(),
        // `result as unknown` keeps this generic; callers that want
        // structured summaries should pass something JSON-serializable.
        result: result as unknown as import("@prisma/client/runtime/library").InputJsonValue,
        error: null,
      },
    });
    return { skipped: false, runId, result };
  } catch (err) {
    await db.cronRun.update({
      where: { runId },
      data: {
        // Leave completedAt null so the next tick retries this run.
        error: truncateError(err),
      },
    });
    throw err;
  }
}

/** Exposed for tests — the bucket logic is small but easy to miswrite. */
export const __internals = { buildRunId, utcDayBucket, truncateError };
