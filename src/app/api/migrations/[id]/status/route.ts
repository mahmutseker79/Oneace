/**
 * Phase MIG-S2 — Migration status polling endpoint (lightweight).
 *
 * GET /api/migrations/[id]/status  — fetch lightweight status + phases + lastUpdate
 */

import { db } from "@/lib/db";
import { requireActiveMembership } from "@/lib/session";
import { type NextRequest, NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { membership } = await requireActiveMembership();

    // Fetch migration job
    const job = await db.migrationJob.findUnique({
      where: { id },
    });

    if (!job) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Migration not found" },
        { status: 404 },
      );
    }

    // Tenant check
    if (job.organizationId !== membership.organizationId) {
      return NextResponse.json({ error: "FORBIDDEN", message: "Access denied" }, { status: 403 });
    }

    // Extract phases from importResults if available
    const importResults = job.importResults as any;
    const phases = importResults?.phases || [];

    return NextResponse.json(
      {
        status: job.status,
        phases,
        lastUpdate: job.updatedAt,
        completedAt: job.completedAt,
        cancelledAt: job.cancelledAt,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("GET /api/migrations/[id]/status error:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to fetch status" },
      { status: 500 },
    );
  }
}
