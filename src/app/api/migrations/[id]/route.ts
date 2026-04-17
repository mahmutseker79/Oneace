/**
 * Phase MIG-S2 — Migration detail and delete endpoint.
 *
 * GET    /api/migrations/[id]     — fetch migration job details
 * DELETE /api/migrations/[id]     — soft-delete a migration (only if PENDING/CANCELLED/FAILED)
 */

import { db } from "@/lib/db";
import { requireActiveMembership } from "@/lib/session";
import { hasCapability } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

// ─────────────────────────────────────────────────────────────────────────────
// GET: Fetch migration details
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const { membership } = await requireActiveMembership();

    const job = await db.migrationJob.findUnique({
      where: { id },
    });

    if (!job) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Migration not found" },
        { status: 404 }
      );
    }

    // Tenant check
    if (job.organizationId !== membership.organizationId) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Access denied" },
        { status: 403 }
      );
    }

    return NextResponse.json({ migration: job }, { status: 200 });
  } catch (error) {
    console.error("GET /api/migrations/[id] error:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to fetch migration" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE: Soft-delete a migration (only if not yet started)
// ─────────────────────────────────────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const { membership, user } = await requireActiveMembership();

    // Check permission
    if (!hasCapability(membership.role, "integrations.connect")) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const job = await db.migrationJob.findUnique({
      where: { id },
    });

    if (!job) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Migration not found" },
        { status: 404 }
      );
    }

    // Tenant check
    if (job.organizationId !== membership.organizationId) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Access denied" },
        { status: 403 }
      );
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
        { status: 409 }
      );
    }

    // Soft delete: mark as CANCELLED with deletion timestamp
    const updated = await db.migrationJob.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        notes: "Deleted by user",
      },
    });

    // Audit log
    await recordAudit({
      db,
      organizationId: membership.organizationId,
      action: "migration.deleted",
      actor: user,
      entity: { type: "MigrationJob", id },
      metadata: { previousStatus: job.status },
    });

    return NextResponse.json({ migration: updated }, { status: 200 });
  } catch (error) {
    console.error("DELETE /api/migrations/[id] error:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to delete migration" },
      { status: 500 }
    );
  }
}
