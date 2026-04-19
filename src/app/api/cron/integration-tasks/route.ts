/**
 * @openapi-tag: /cron/integration-tasks
 *
 * Audit v1.3 §5.53 F-09 — the tag above is the canonical route path.
 * docs/openapi.yaml MUST declare the same path with every HTTP method
 * this file exports. `src/lib/openapi-parity.test.ts` pins the two in
 * lockstep.
 */
/**
 * IntegrationTask queue consumer (audit v1.3 §5.53 F-09).
 *
 * Background — before this cron existed, every adapter under
 * `src/lib/integrations/` (shopify, quickbooks, amazon, bigcommerce,
 * magento, odoo, wix, woocommerce, xero, zoho, …) handled transient
 * upstream failures in-process. A 503 from QuickBooks → exception →
 * `logger.warn` → task gone. `SyncLog` records the AGGREGATE outcome
 * of a sync; it is not a retry queue. The `IntegrationTask` table is
 * the retry queue; this cron is its drain.
 *
 * What this cron does:
 *
 *   1. Claim up to `BATCH_SIZE` due `pending` rows atomically via
 *      `claimDueTasks()` — the helper uses `UPDATE … WHERE id IN
 *      (SELECT … FOR UPDATE SKIP LOCKED) RETURNING …` so two
 *      concurrent cron invocations cannot double-claim.
 *   2. Dispatch each task to its handler by `integrationKind` →
 *      `taskKind`. Handlers are registered in the dispatch registry
 *      (`src/lib/integrations/task-dispatch-registry.ts`) via
 *      adapter-local `register.ts` files; the `handlers` barrel is
 *      imported here for its side effects. Unknown pairs throw
 *      `SCHEMA_UNWIRED_ADAPTER` so partially-wired adapters surface
 *      in the DLQ dashboard rather than silently looping. See
 *      `docs/ADR-005-integration-handler-registry.md` for the
 *      per-adapter contract.
 *   3. On success → `markDone(taskId)`. On failure → `markFailure(
 *      taskId, err)` which classifies, reschedules on the backoff
 *      curve, and flips to `dead` (+ owner email) once MAX_RETRIES
 *      is hit.
 *
 * Deliberate non-choices:
 *
 *   - **No `withCronIdempotency`.** The cron is designed to run
 *     every 30 minutes; a daily-bucket idempotency would silence it
 *     after its first run. Atomic row claim provides the correctness
 *     guarantee, not invocation-level idempotency.
 *   - **Single `nodejs` runtime.** Edge runtime cannot use the
 *     Prisma client. `task-queue.ts` imports `@/lib/db`.
 *   - **Bounded per-invocation work.** `BATCH_SIZE` + a per-task
 *     time budget keeps a single drain well inside Vercel Hobby's
 *     60s ceiling. If the queue is backlogged, successive cron runs
 *     chip away at it — better that than a wall-clock timeout that
 *     leaves half the batch in an `in_progress` limbo.
 *   - **No retry inside the handler.** `base-client.ts` already
 *     retries inside a single API call. The queue layer retries the
 *     whole task. Nesting a third retry layer inside the handler
 *     would just multiply the blast radius of a flapping upstream.
 *
 * Auth: CRON_SECRET Bearer header (same pattern as sibling cron
 * routes). Schedule: `*\/30 * * * *` in vercel.json.
 */

import { logger } from "@/lib/logger";
import {
  type ClaimedTask,
  claimDueTasks,
  markDone,
  markFailure,
} from "@/lib/integrations/task-queue";
import { dispatch } from "@/lib/integrations/task-dispatch-registry";
// Side-effect import — each adapter's `register.ts` calls
// `registerHandler(...)` at module top-level. This barrel MUST
// be imported before the first `dispatch(task)` call on a cold
// lambda so the registry is populated. See
// `docs/ADR-005-integration-handler-registry.md §5` (load order).
import "@/lib/integrations/handlers";
import { type NextRequest, NextResponse } from "next/server";

export const maxDuration = 60; // Vercel Hobby cron timeout
export const runtime = "nodejs";

/**
 * Maximum rows claimed per invocation. Sized to fit the 60-second
 * Vercel ceiling even if every task takes a full second of real work;
 * realistic adapter calls complete in ~100-500ms so the ceiling is
 * conservative. If drains consistently saturate this number the
 * follow-up is to raise the cron frequency, not the batch size —
 * larger batches grow the failure blast radius of a single timeout.
 */
const BATCH_SIZE = 25;

type OutcomeBody =
  | {
      ok: true;
      status: "drained";
      claimed: number;
      done: number;
      failed: number;
    }
  | {
      ok: true;
      status: "idle";
      claimed: 0;
    }
  | { ok: true; status: "skipped"; reason: "config" | "transport"; detail?: string };

// Per-task dispatch is now owned by the dispatch registry. Adapter
// PRs register handlers through `registerHandler(kind, taskKind,
// fn)`; unregistered pairs throw `SCHEMA_UNWIRED_ADAPTER` which
// `classifyError()` routes to `schema-mismatch` so the DLQ surfaces
// the wiring gap. See `docs/ADR-005-integration-handler-registry.md`.

export async function GET(request: NextRequest): Promise<NextResponse<OutcomeBody>> {
  // ── 1. Auth gate ──────────────────────────────────────────────────
  const cronSecret = request.headers.get("Authorization")?.replace("Bearer ", "");
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    logger.warn("CRON_SECRET not configured for integration-tasks", {
      tag: "cron.integration-tasks.no-secret",
    });
    return NextResponse.json(
      { ok: true, status: "skipped", reason: "config", detail: "CRON_SECRET" },
      { status: 500 },
    );
  }

  if (!cronSecret || cronSecret !== expectedSecret) {
    logger.warn("Invalid cron secret for integration-tasks", {
      tag: "cron.integration-tasks.unauthorized",
    });
    return NextResponse.json(
      { ok: true, status: "skipped", reason: "config", detail: "unauthorized" },
      { status: 401 },
    );
  }

  // ── 2. Claim a bounded batch of due tasks ────────────────────────
  let claimed: ClaimedTask[];
  try {
    claimed = await claimDueTasks({ limit: BATCH_SIZE });
  } catch (err) {
    logger.warn("integration-tasks: claim query failed — transient skip", {
      tag: "cron.integration-tasks.claim-failed",
      err,
    });
    return NextResponse.json({
      ok: true,
      status: "skipped",
      reason: "transport",
      detail: "claim",
    });
  }

  if (claimed.length === 0) {
    logger.info("integration-tasks: queue empty", {
      tag: "cron.integration-tasks.idle",
    });
    return NextResponse.json({ ok: true, status: "idle", claimed: 0 });
  }

  logger.info("integration-tasks: drain starting", {
    tag: "cron.integration-tasks.drain-start",
    claimed: claimed.length,
  });

  // ── 3. Dispatch each task. One task's failure must not starve
  //       the rest of the batch — catch at the loop boundary. ────────
  let done = 0;
  let failed = 0;

  for (const task of claimed) {
    try {
      await dispatch(task);
      await markDone(task.id);
      done += 1;
    } catch (handlerErr) {
      // `markFailure` classifies, reschedules, and flips to `dead`
      // once MAX_RETRIES is hit — don't replicate that logic here.
      try {
        await markFailure(task.id, handlerErr);
      } catch (bookkeepingErr) {
        // If even the bookkeeping write fails, the row stays in
        // `in_progress` and a future claim will re-pick it up after
        // the SKIP-LOCKED lock releases. Log loudly so ops notices.
        logger.error("integration-tasks: markFailure bookkeeping failed", {
          tag: "cron.integration-tasks.bookkeeping-failed",
          taskId: task.id,
          handlerErr,
          bookkeepingErr,
        });
      }
      failed += 1;
    }
  }

  logger.info("integration-tasks: drain completed", {
    tag: "cron.integration-tasks.drain-done",
    claimed: claimed.length,
    done,
    failed,
  });

  return NextResponse.json({
    ok: true,
    status: "drained",
    claimed: claimed.length,
    done,
    failed,
  });
}
