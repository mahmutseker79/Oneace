/**
 * @openapi-tag: /cron/process-imports
 *
 * P3-4 (audit v1.1 §5.32) — the tag above is the canonical route
 * path. docs/openapi.yaml MUST declare the same path with every
 * HTTP method this file exports. `src/lib/openapi-parity.test.ts`
 * pins the two in lockstep.
 */
/**
 * Cron endpoint to process pending import jobs.
 *
 * This endpoint is meant to be called by Vercel Cron, which has a 60-second timeout.
 * We check the CRON_SECRET header for security, then process one job at a time.
 *
 * Usage: Set up a Vercel cron trigger in vercel.json with crons array.
 */

import { processNextJob } from "@/lib/jobs/queue";
import { logger } from "@/lib/logger";
import { type NextRequest, NextResponse } from "next/server";

export const maxDuration = 60; // Vercel Hobby cron timeout

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify CRON_SECRET header for security
    const cronSecret = request.headers.get("Authorization")?.replace("Bearer ", "");
    const expectedSecret = process.env.CRON_SECRET;

    if (!expectedSecret) {
      logger.warn("CRON_SECRET not configured");
      return NextResponse.json({ error: "Cron secret not configured" }, { status: 500 });
    }

    if (!cronSecret || cronSecret !== expectedSecret) {
      logger.warn("Invalid cron secret provided");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Process one job
    const job = await processNextJob();

    if (!job) {
      return NextResponse.json({
        message: "No pending jobs",
        processed: 0,
      });
    }

    return NextResponse.json({
      message: "Job processed",
      jobId: job.id,
      status: job.status,
      processed: 1,
    });
  } catch (error) {
    logger.error("Cron job processing failed", { error });
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
