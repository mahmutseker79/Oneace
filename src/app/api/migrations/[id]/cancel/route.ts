/**
 * @openapi-tag: /migrations/[id]/cancel
 *
 * P3-4 (audit v1.1 §5.32) — the tag above is the canonical route
 * path. docs/openapi.yaml MUST declare the same path with every
 * HTTP method this file exports. `src/lib/openapi-parity.test.ts`
 * pins the two in lockstep.
 */
/**
 * Phase MIG-S2 — Migration cancel endpoint.
 *
 * POST /api/migrations/[id]/cancel  — mark migration CANCELLED (only if not currently IMPORTING)
 */

import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";
import { type NextRequest, NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { session, membership } = await requireActiveMembership();

    // Check permission
    if (!hasCapability(membership.role, "integrations.connect")) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Insufficient permissions" },
        { status: 403 },
      );
    }

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

    // Cannot cancel if currently IMPORTING (use rollback instead)
    if (job.status === "IMPORTING") {
      return NextResponse.json(
        {
          error: "INVALID_STATE",
          message: "Cannot cancel during import. Use rollback after completion.",
          currentStatus: job.status,
        },
        { status: 409 },
      );
    }

    // Cannot cancel if already COMPLETED or CANCELLED
    if (["COMPLETED", "CANCELLED"].includes(job.status)) {
      return NextResponse.json(
        {
          error: "INVALID_STATE",
          message: "Migration is already in a terminal state",
          currentStatus: job.status,
        },
        { status: 409 },
      );
    }

    // Update to CANCELLED with notes (no cancelledAt field)
    const cancellationNote = `Cancelled by user at ${new Date().toISOString()}`;
    const updatedNotes = job.notes ? `${job.notes}; ${cancellationNote}` : cancellationNote;
    const updated = await db.migrationJob.update({
      where: { id },
      data: {
        status: "CANCELLED",
        notes: updatedNotes,
      },
    });

    // Audit log
    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "migration.cancelled",
      entityType: "migration_job",
      entityId: id,
      metadata: { previousStatus: job.status },
    });

    return NextResponse.json({ migration: updated }, { status: 200 });
  } catch (error) {
    console.error("POST /api/migrations/[id]/cancel error:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to cancel migration" },
      { status: 500 },
    );
  }
}
