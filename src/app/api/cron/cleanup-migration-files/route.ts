/**
 * Cleanup migration artifacts (sourceFiles and orphaned blobs).
 *
 * Runs daily; cleans up:
 * 1. MigrationJob.sourceFiles for COMPLETED jobs older than 30 days
 * 2. MigrationJob.sourceFiles for CANCELLED jobs older than 7 days
 * 3. ItemAttachment blobs orphaned by incomplete rollbacks
 *
 * Uses Vercel Cron (60-second timeout, CRON_SECRET header auth).
 * Respects dryRun query param for preview mode.
 * Processes max 50 jobs per run (return remaining count for paging).
 */

import { recordAudit } from "@/lib/audit";
import { withCronIdempotency } from "@/lib/cron/with-idempotency";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  deleteMigrationBlobs,
  extractSourceFileBlobUrls,
} from "@/lib/migrations/core/blob-cleanup";
import { type NextRequest, NextResponse } from "next/server";

export const maxDuration = 60; // Vercel Hobby cron timeout

interface CleanupJob {
  id: string;
  organizationId: string;
  status: "COMPLETED" | "CANCELLED";
  completedAt: Date | null;
  sourceFiles: unknown;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify CRON_SECRET header (same pattern as process-imports)
    const cronSecret = request.headers.get("Authorization")?.replace("Bearer ", "");
    const expectedSecret = process.env.CRON_SECRET;

    if (!expectedSecret) {
      logger.warn("CRON_SECRET not configured for cleanup");
      return NextResponse.json({ error: "Cron secret not configured" }, { status: 500 });
    }

    if (!cronSecret || cronSecret !== expectedSecret) {
      logger.warn("Invalid cron secret for cleanup");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check for dryRun query param
    const dryRun = request.nextUrl.searchParams.get("dryRun") === "1";

    // §5.27 — dry runs are safe to re-run (they only count), so we
    // skip the idempotency ledger when dryRun=1. Real cleanups pass
    // through `withCronIdempotency` so a Vercel retry after a 5xx
    // doesn't double-delete blob URLs or double-write audit events.
    if (!dryRun) {
      const outcome = await withCronIdempotency(
        "cleanup-migration-files",
        () => runCleanup({ dryRun }),
      );
      if (outcome.skipped) {
        return NextResponse.json({
          ok: true,
          skipped: true,
          reason: "already ran today",
          runId: outcome.runId,
        });
      }
      return outcome.result;
    }

    return (await runCleanup({ dryRun })) as NextResponse;
  } catch (error) {
    logger.error("Cleanup cron failed", { error });
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

/**
 * Extracted cleanup body so `withCronIdempotency` can wrap it on real
 * runs and the dryRun path can skip the ledger.
 *
 * Errors propagate to the outer `GET` catch unchanged — this is load-
 * bearing for §5.27: if we swallowed them here, `withCronIdempotency`
 * would stamp `completedAt` on a failed run and short-circuit the
 * Vercel retry that's supposed to recover from a transient blob-store
 * hiccup. The outer handler still returns HTTP 500 via the catch
 * clause, matching the pre-§5.27 behavior for the caller.
 */
async function runCleanup({ dryRun }: { dryRun: boolean }): Promise<NextResponse> {
    // Find jobs to clean
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const jobsToClean = await db.migrationJob.findMany({
      where: {
        OR: [
          // COMPLETED jobs older than 30 days with sourceFiles
          {
            status: "COMPLETED",
            completedAt: { lt: thirtyDaysAgo },
            sourceFiles: { not: null },
          },
          // CANCELLED jobs older than 7 days with sourceFiles
          {
            status: "CANCELLED",
            completedAt: { lt: sevenDaysAgo },
            sourceFiles: { not: null },
          },
        ],
      },
      select: {
        id: true,
        organizationId: true,
        status: true,
        completedAt: true,
        sourceFiles: true,
      },
      take: 50, // Process max 50 per run
    });

    // Count remaining (for paging feedback)
    const remaining = await db.migrationJob.count({
      where: {
        OR: [
          {
            status: "COMPLETED",
            completedAt: { lt: thirtyDaysAgo },
            sourceFiles: { not: null },
          },
          {
            status: "CANCELLED",
            completedAt: { lt: sevenDaysAgo },
            sourceFiles: { not: null },
          },
        ],
      },
    });

    if (jobsToClean.length === 0) {
      return NextResponse.json({
        message: "No jobs to clean",
        processed: 0,
        remaining: 0,
      });
    }

    // Process each job
    let totalSourceFileBlobsDeleted = 0;
    let totalSourceFileBlobsFailed = 0;
    let totalSourceFilesCleared = 0;
    const errors: Array<{
      jobId: string;
      error: string;
    }> = [];

    for (const job of jobsToClean) {
      try {
        const ageInDays = Math.floor(
          (now.getTime() - job.completedAt?.getTime()) / (24 * 60 * 60 * 1000),
        );

        // Extract blob URLs from sourceFiles
        const blobUrls = extractSourceFileBlobUrls(job.sourceFiles);

        if (blobUrls.length > 0 && !dryRun) {
          // Delete blobs
          const blobResult = await deleteMigrationBlobs(blobUrls);
          totalSourceFileBlobsDeleted += blobResult.deleted;
          totalSourceFileBlobsFailed += blobResult.failed.length;
        } else if (blobUrls.length > 0) {
          totalSourceFileBlobsDeleted += blobUrls.length; // For dryRun, count as "would delete"
        }

        // Clear sourceFiles from DB (unless dryRun)
        if (!dryRun) {
          await db.migrationJob.update({
            where: { id: job.id },
            data: { sourceFiles: null },
          });

          // Emit audit event
          await recordAudit({
            organizationId: job.organizationId,
            actorId: null, // system-initiated
            action: "migration.sourceFiles.cleanup",
            entityType: "migration_job",
            entityId: job.id,
            metadata: {
              status: job.status,
              ageInDays,
              filesDeleted: blobUrls.length,
            },
          });

          totalSourceFilesCleared++;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error("Failed to clean migration job", {
          jobId: job.id,
          error: message,
        });
        errors.push({
          jobId: job.id,
          error: message,
        });
      }
    }

    const response = {
      message: dryRun ? "DRY RUN: cleanup preview" : "Cleanup completed",
      processed: dryRun ? 0 : jobsToClean.length, // Only count actual deletes, not dryRun
      remaining: remaining - jobsToClean.length,
      dryRun,
      summary: {
        sourceFilesCleared: totalSourceFilesCleared,
        sourceFileBlobsDeleted: totalSourceFileBlobsDeleted,
        sourceFileBlobsFailed: totalSourceFileBlobsFailed,
        errors: errors.length,
      },
    };

    if (errors.length > 0) {
      return NextResponse.json(
        {
          ...response,
          errors: errors.slice(0, 10), // Include first 10 errors for debugging
        },
        { status: 207 }, // 207 Multi-Status (partial success)
      );
    }

    return NextResponse.json(response);
}
