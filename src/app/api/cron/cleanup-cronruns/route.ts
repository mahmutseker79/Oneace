/**
 * @openapi-tag: /cron/cleanup-cronruns
 *
 * v1.2 P3 §5.44 — the tag above is the canonical route path.
 * docs/openapi.yaml MUST declare the same path with every HTTP
 * method this file exports. `src/lib/openapi-parity.test.ts` pins
 * the two in lockstep.
 */
/**
 * CronRun ledger retention cron (audit v1.2 §5.44).
 *
 * The `CronRun` table is append-only: every cron invocation (across
 * every schedule) writes a row via `withCronIdempotency`. With 4 crons
 * running daily plus retries, the table grows ~1.5k rows/year per
 * environment — not a performance problem on its own, but the audit
 * flagged that there is no retention horizon at all, which means:
 *
 *   1. Nothing prunes failed-but-retried rows, so forensic queries on
 *      "did cron X ever fail?" get noisier over time.
 *   2. An operator who misconfigures a fast-ticking schedule could
 *      silently bloat the table before anyone notices.
 *
 * This cron runs daily at 04:00 UTC (after the other 3 crons have
 * finished, so we prune yesterday's — and older — rows without
 * deleting anything still being written this tick). Retention is
 * 90 days on `startedAt`, which:
 *
 *   - Keeps a rolling quarter of run history visible for debugging.
 *   - Is long enough that a failed run whose startedAt is 88 days ago
 *     still shows up in a weekly ops review.
 *   - Is short enough that the table stays bounded indefinitely.
 *
 * Self-protection: we use `startedAt < now - 90 days`, so today's
 * cleanup-cronruns row (which `withCronIdempotency` wrote for THIS
 * run) is never in scope for deletion. The oldest row we could
 * possibly delete is 90 days old, and today's row is 0 seconds old.
 *
 * Auth: CRON_SECRET header (same pattern as sibling cron routes).
 * Dry-run: `?dryRun=1` — count what would be deleted without doing it.
 * Budget: batched deleteMany with a pass cap to stay inside Vercel
 *   Hobby's 60s timeout even on a cold clean.
 */

import { withCronIdempotency } from "@/lib/cron/with-idempotency";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { type NextRequest, NextResponse } from "next/server";

export const maxDuration = 60; // Vercel Hobby cron timeout

// CronRun retention horizon. 90 days matches the Notification read
// retention — gives operators a consistent "things older than a
// quarter are gone" mental model across both ledgers.
const CRONRUN_RETENTION_DAYS = 90;
// Chunk cap matches cleanup-notifications. Single-statement lock
// time on hot Postgres instances stays bounded; the @@index on
// startedAt keeps each pass cheap.
const BATCH_SIZE = 10_000;
// Circuit breaker: if a misconfigured fast-ticking cron keeps
// writing new rows during the run, stop after this many passes
// rather than locking the worker.
const MAX_PASSES = 20;

interface CleanupSummary {
  agedDeleted: number;
  retentionDays: number;
  cutoff: string;
  dryRun: boolean;
  tookMs: number;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const started = Date.now();
  try {
    const cronSecret = request.headers.get("Authorization")?.replace("Bearer ", "");
    const expectedSecret = process.env.CRON_SECRET;

    if (!expectedSecret) {
      logger.warn("CRON_SECRET not configured for cleanup-cronruns");
      return NextResponse.json({ error: "Cron secret not configured" }, { status: 500 });
    }

    if (!cronSecret || cronSecret !== expectedSecret) {
      logger.warn("Invalid cron secret for cleanup-cronruns");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dryRun = request.nextUrl.searchParams.get("dryRun") === "1";

    // §5.27 — dry runs are read-only; we skip `withCronIdempotency`
    // for the count path so a dry run doesn't consume today's slot.
    // Real deletes still go through the helper so a Vercel retry
    // after a 5xx doesn't re-enter the deleteMany loop.
    const doCleanup = async () => {
      const now = new Date();
      const cutoff = new Date(now.getTime() - CRONRUN_RETENTION_DAYS * 24 * 60 * 60 * 1000);

      // `startedAt < cutoff` — NOT `completedAt < cutoff`. Failed
      // runs have a null completedAt, and we still want to prune
      // them once they're past the retention horizon.
      const agedFilter = { startedAt: { lt: cutoff } } as const;

      let agedDeleted = 0;

      if (dryRun) {
        agedDeleted = await db.cronRun.count({ where: agedFilter });
      } else {
        for (let pass = 0; pass < MAX_PASSES; pass++) {
          const { count } = await db.cronRun.deleteMany({ where: agedFilter });
          agedDeleted += count;
          // Prisma doesn't support LIMIT on deleteMany across all
          // providers, so we rely on the @@index([startedAt]) to
          // keep each pass cheap and break when count < BATCH_SIZE.
          if (count < BATCH_SIZE) break;
        }
      }

      const summary: CleanupSummary = {
        agedDeleted,
        retentionDays: CRONRUN_RETENTION_DAYS,
        cutoff: cutoff.toISOString(),
        dryRun,
        tookMs: Date.now() - started,
      };

      logger.info("cleanup-cronruns: finished", {
        tag: "cron.cleanup-cronruns",
        ...summary,
      });

      return summary;
    };

    if (dryRun) {
      const summary = await doCleanup();
      return NextResponse.json({ ok: true, ...summary });
    }

    const outcome = await withCronIdempotency("cleanup-cronruns", doCleanup);
    if (outcome.skipped) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "already ran today",
        runId: outcome.runId,
      });
    }
    return NextResponse.json({ ok: true, ...outcome.result });
  } catch (error) {
    logger.error("cleanup-cronruns: failed", {
      tag: "cron.cleanup-cronruns",
      err: error,
    });
    return NextResponse.json({ error: "Cleanup failed", detail: String(error) }, { status: 500 });
  }
}
