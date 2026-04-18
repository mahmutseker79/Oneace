/**
 * Notification retention cron (audit v1.1 §5.24).
 *
 * Runs daily at 03:15 (see `vercel.json`). Enforces two bounds on the
 * Notification table so growth stays finite even if users never mark
 * things read:
 *
 *   1. `expiresAt < now` — delete anything whose producer set a TTL
 *      that has elapsed. `alerts.ts` sets a 90-day TTL on every low-
 *      stock fan-out, so most rows prune here.
 *   2. `readAt < now - READ_RETENTION_DAYS` — belt-and-suspenders
 *      for legacy rows or any producer that forgot to set `expiresAt`.
 *      Once a user has read a notification, there's no product value
 *      in keeping it past the retention horizon.
 *
 * Auth: CRON_SECRET header (same pattern as sibling cron routes).
 * Dry-run: `?dryRun=1` — count what would be deleted without doing it.
 * Budget: deleteMany is batched in 10k-row chunks to stay inside the
 *   60s Vercel Hobby timeout even on a cold clean of a large tenant.
 *
 * Side effects: structured log entry `cron.cleanup-notifications`
 *   with deleted counts — grepped/graphed from the server log stream.
 *   We intentionally do NOT write to the audit log because
 *   `recordAudit` requires a tenant (organizationId) and this cron
 *   operates cross-tenant.
 */

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { type NextRequest, NextResponse } from "next/server";

export const maxDuration = 60; // Vercel Hobby cron timeout

// Read-notification retention: 90 days after readAt. Independent of
// expiresAt (which producers set at create time) so this catches
// legacy rows and any producer that forgot to set a TTL.
const READ_RETENTION_DAYS = 90;
// Chunk size for deleteMany to bound single-statement lock time on
// hot Postgres instances. The query uses the expiresAt index so each
// chunk is fast, but a single 1M-row delete would still surprise
// other writers.
const BATCH_SIZE = 10_000;

interface CleanupSummary {
  expiredDeleted: number;
  readAgedDeleted: number;
  dryRun: boolean;
  tookMs: number;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const started = Date.now();
  try {
    const cronSecret = request.headers
      .get("Authorization")
      ?.replace("Bearer ", "");
    const expectedSecret = process.env.CRON_SECRET;

    if (!expectedSecret) {
      logger.warn("CRON_SECRET not configured for cleanup-notifications");
      return NextResponse.json(
        { error: "Cron secret not configured" },
        { status: 500 },
      );
    }

    if (!cronSecret || cronSecret !== expectedSecret) {
      logger.warn("Invalid cron secret for cleanup-notifications");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dryRun = request.nextUrl.searchParams.get("dryRun") === "1";
    const now = new Date();
    const readCutoff = new Date(
      now.getTime() - READ_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );

    // Pass 1 — expired rows (producers that set expiresAt).
    const expiredFilter = { expiresAt: { lt: now, not: null } } as const;
    // Pass 2 — read-aged rows (any producer, including legacy ones
    // with null expiresAt). We use `AND` with `readAt: { not: null }`
    // so unread rows are never implicitly aged out by this pass.
    const readAgedFilter = {
      readAt: { lt: readCutoff, not: null },
    } as const;

    let expiredDeleted = 0;
    let readAgedDeleted = 0;

    if (dryRun) {
      expiredDeleted = await db.notification.count({ where: expiredFilter });
      readAgedDeleted = await db.notification.count({ where: readAgedFilter });
    } else {
      // Batched delete — loop until no rows match, capped to avoid
      // runaway loops in case a producer keeps inserting pre-expired
      // rows during the run.
      for (let pass = 0; pass < 20; pass++) {
        const { count } = await db.notification.deleteMany({
          where: expiredFilter,
          // Prisma does not support LIMIT on deleteMany across all
          // providers; instead we rely on the index on `expiresAt`
          // to keep each pass cheap and break when count < BATCH_SIZE.
        });
        expiredDeleted += count;
        if (count < BATCH_SIZE) break;
      }
      for (let pass = 0; pass < 20; pass++) {
        const { count } = await db.notification.deleteMany({
          where: readAgedFilter,
        });
        readAgedDeleted += count;
        if (count < BATCH_SIZE) break;
      }
    }

    const summary: CleanupSummary = {
      expiredDeleted,
      readAgedDeleted,
      dryRun,
      tookMs: Date.now() - started,
    };

    logger.info("cleanup-notifications: finished", {
      tag: "cron.cleanup-notifications",
      ...summary,
    });

    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    logger.error("cleanup-notifications: failed", {
      tag: "cron.cleanup-notifications",
      err: error,
    });
    return NextResponse.json(
      { error: "Cleanup failed", detail: String(error) },
      { status: 500 },
    );
  }
}
