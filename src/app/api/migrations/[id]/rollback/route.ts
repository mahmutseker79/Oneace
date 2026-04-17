/**
 * POST /api/migrations/[id]/rollback
 *
 * Rolls back a completed or failed migration by deleting all rows it created.
 * Requires authentication, active membership, and integrations.disconnect capability.
 */

import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { rollbackMigration } from "@/lib/migrations/core/rollback";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";
import { NextResponse } from "next/server";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Auth: require active membership.
    const { membership, session } = await requireActiveMembership();

    // Capability check: integrations.disconnect is the closest existing capability.
    if (!hasCapability(membership.role, "integrations.disconnect")) {
      return NextResponse.json(
        { error: "Missing integrations.disconnect capability" },
        { status: 403 },
      );
    }

    // Resolve route params.
    const { id: migrationJobId } = await params;

    // Verify the job belongs to this organization.
    const job = await db.migrationJob.findUnique({
      where: { id: migrationJobId },
    });

    if (!job) {
      return NextResponse.json({ error: "Migration job not found" }, { status: 404 });
    }

    if (job.organizationId !== membership.organizationId) {
      return NextResponse.json({ error: "Organization mismatch" }, { status: 404 });
    }

    // Invoke rollback.
    const result = await rollbackMigration({
      db,
      migrationJobId,
      organizationId: membership.organizationId,
      userId: session.user.id,
    });

    // Emit audit event.
    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "migration.rollback",
      entityType: "migration_job",
      entityId: migrationJobId,
      metadata: {
        deletedCounts: result.deletedCounts,
        success: result.success,
        errorCount: result.errors.length,
      },
    });

    return NextResponse.json({
      success: result.success,
      migrationJobId: result.migrationJobId,
      startedAt: result.startedAt,
      completedAt: result.completedAt,
      deletedCounts: result.deletedCounts,
      errors: result.errors,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // Map known error types to HTTP status codes.
    if (message.includes("status=")) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    if (message.includes("Organization mismatch")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    // Generic error.
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
