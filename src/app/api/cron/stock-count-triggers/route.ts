/**
 * Phase B5.2 — Cron endpoint for stock count trigger pass.
 *
 * Called every 15 minutes by Vercel Cron or an external scheduler.
 * Checks all recurring count templates across every organization and
 * creates new StockCount records when their schedules fire.
 *
 * Authorization: Bearer token from CRON_SECRET env var.
 * This prevents unauthorized invocations while keeping the route
 * publicly reachable for the cron scheduler.
 */

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { runTriggerPass } from "@/lib/stockcount/triggers";
import { type NextRequest, NextResponse } from "next/server";

/**
 * GET /api/cron/stock-count-triggers
 *
 * Vercel Cron sends GET requests. Accepts Bearer token for auth.
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate via Bearer token
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      logger.error("CRON_SECRET not configured — cron endpoint disabled");
      return NextResponse.json({ error: "Cron endpoint not configured" }, { status: 503 });
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      logger.warn("Unauthorized cron request");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();

    // Fetch all organizations that have at least one recurring template.
    const orgs = await db.organization.findMany({
      where: {
        countTemplates: {
          some: { isRecurring: true },
        },
      },
      select: { id: true },
    });

    if (orgs.length === 0) {
      return NextResponse.json({ triggered: 0, results: [] });
    }

    // Run trigger pass per organization (isolated tenant scoping).
    const allResults: Array<{
      organizationId: string;
      templateId: string;
      countId: string | null;
      reason: string;
    }> = [];

    for (const org of orgs) {
      const results = await runTriggerPass(org.id, now);
      for (const r of results) {
        allResults.push({ organizationId: org.id, ...r });
      }
    }

    const triggered = allResults.filter((r) => r.countId !== null).length;

    logger.info("Cron trigger pass complete", {
      organizations: orgs.length,
      triggered,
      total: allResults.length,
    });

    return NextResponse.json({
      triggered,
      results: allResults,
    });
  } catch (error) {
    logger.error("Cron trigger pass failed", { error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
