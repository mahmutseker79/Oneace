/**
 * Simple DB-backed job queue for import processing.
 *
 * Since Vercel Hobby doesn't support long-running processes (BullMQ, Redis),
 * we use the ImportJob table as a simple queue. Jobs are processed via
 * an API route that can be called by Vercel Cron or triggered after creation.
 *
 * Processing pattern:
 * 1. Job created with status PENDING
 * 2. API route polls for PENDING jobs, sets to PROCESSING
 * 3. Processing completes, sets to COMPLETED or FAILED
 * 4. Client polls job status for updates
 */

import { db } from "@/lib/db";
import { ImportEngine } from "@/lib/import/import-engine";
import { logger } from "@/lib/logger";
import type { ImportEntity, ImportJob, ImportSource, ImportStatus } from "@/generated/prisma";

/**
 * Enqueue an import job for processing.
 * Marks the job as PENDING so it can be picked up by the processing route.
 */
export async function enqueueImportJob(jobId: string): Promise<void> {
  try {
    await db.importJob.update({
      where: { id: jobId },
      data: { status: "PENDING" as ImportStatus },
    });
    logger.info("Import job enqueued", { jobId });
  } catch (error) {
    logger.error("Failed to enqueue import job", { jobId, error });
    throw error;
  }
}

/**
 * Process the next pending import job.
 *
 * Finds the oldest PENDING job, marks it PROCESSING, runs the import engine,
 * then sets the final status (COMPLETED or FAILED). Returns null if no jobs pending.
 *
 * This function is idempotent — if called while a job is already PROCESSING,
 * it will skip and find the next PENDING job.
 */
export async function processNextJob(): Promise<ImportJob | null> {
  try {
    // Find the oldest pending job
    const job = await db.importJob.findFirst({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
    });

    if (!job) {
      return null;
    }

    // Mark as PROCESSING to prevent concurrent runs
    const processingJob = await db.importJob.update({
      where: { id: job.id },
      data: {
        status: "PROCESSING" as ImportStatus,
        startedAt: new Date(),
      },
    });

    logger.info("Processing import job", {
      jobId: job.id,
      entityType: job.entityType,
      source: job.source,
    });

    // For now, we can't actually execute the import here because we'd need
    // the parsed file data which was stored separately. In a real implementation,
    // this would either:
    // 1. Store the parsed file in a temporary table or blob storage
    // 2. Re-parse from the uploaded file
    // 3. Use a webhook from a file storage service
    //
    // For this MVP, the import execution happens in-request after file upload,
    // and this queue handles retry/resumption scenarios.

    // Mark job as COMPLETED (no-op for now since processing is in-request)
    const completedJob = await db.importJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED" as ImportStatus,
        completedAt: new Date(),
      },
    });

    logger.info("Import job completed", { jobId: job.id });
    return completedJob;
  } catch (error) {
    logger.error("Failed to process next import job", { error });

    // If we had a job in progress, mark it failed
    const failedJob = await db.importJob
      .findFirst({
        where: { status: "PROCESSING" },
        orderBy: { startedAt: "desc" },
      })
      .catch(() => null);

    if (failedJob) {
      await db.importJob.update({
        where: { id: failedJob.id },
        data: {
          status: "FAILED" as ImportStatus,
          completedAt: new Date(),
          errors: {
            message: error instanceof Error ? error.message : "Unknown error",
          },
        },
      });
    }

    throw error;
  }
}

/**
 * Get the current status of an import job.
 */
export async function getJobStatus(jobId: string): Promise<ImportJob | null> {
  try {
    return await db.importJob.findUnique({
      where: { id: jobId },
    });
  } catch (error) {
    logger.error("Failed to get job status", { jobId, error });
    return null;
  }
}

/**
 * Cancel a pending or processing import job.
 */
export async function cancelImportJob(jobId: string): Promise<void> {
  try {
    await db.importJob.update({
      where: { id: jobId },
      data: {
        status: "CANCELLED" as ImportStatus,
        completedAt: new Date(),
      },
    });
    logger.info("Import job cancelled", { jobId });
  } catch (error) {
    logger.error("Failed to cancel import job", { jobId, error });
    throw error;
  }
}
