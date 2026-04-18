/**
 * @openapi-tag: /migrations/[id]
 *
 * P3-4 (audit v1.1 §5.32) — the tag above is the canonical route
 * path. docs/openapi.yaml MUST declare the same path with every
 * HTTP method this file exports. `src/lib/openapi-parity.test.ts`
 * pins the two in lockstep.
 */
/**
 * Phase MIG-S2 — Migration detail and delete endpoint.
 *
 * GET    /api/migrations/[id]     — fetch migration job details
 * DELETE /api/migrations/[id]     — soft-delete a migration (only if PENDING/CANCELLED/FAILED)
 */

import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";
import { type NextRequest, NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

// ─────────────────────────────────────────────────────────────────────────────
// GET: Fetch migration details
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { membership } = await requireActiveMembership();

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

    return NextResponse.json({ migration: job }, { status: 200 });
  } catch (error) {
    console.error("GET /api/migrations/[id] error:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to fetch migration" },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE: Soft-delete a migration (only if not yet started)
// ─────────────────────────────────────────────────────────────────────────────

export async function DELETE(request: NextRequest, context: RouteContext) {
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

    // Only allow deletion in safe states
    const DELETABLE_STATES = [
      "PENDING",
      "FILES_UPLOADED",
      "MAPPING_REVIEW",
      "VALIDATING",
      "VALIDATED",
      "FAILED",
      "CANCELLED",
    ];
    if (!DELETABLE_STATES.includes(job.status)) {
      return NextResponse.json(
        {
          error: "INVALID_STATE",
          message: `Cannot delete migration in ${job.status} state`,
          currentStatus: job.status,
        },
        { status: 409 },
      );
    }

    // Soft delete: mark as CANCELLED and update notes with deletion timestamp
    const deletionNote = `Deleted by user at ${new Date().toISOString()}`;
    const updatedNotes = job.notes ? `${job.notes}; ${deletionNote}` : deletionNote;
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
      action: "migration.deleted",
      entityType: "migration_job",
      entityId: id,
      metadata: { previousStatus: job.status },
    });

    return NextResponse.json({ migration: updated }, { status: 200 });
  } catch (error) {
    console.error("DELETE /api/migrations/[id] error:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to delete migration" },
      { status: 500 },
    );
  }
}
