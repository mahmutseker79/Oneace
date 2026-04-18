/**
 * POST /api/migrations/[id]/rollback
 *
 * P1-2 (audit v1.0 §5.7): SUSPENDED for v1.
 *
 * The rollback engine in `src/lib/migrations/core/rollback.ts` only
 * reverts rows recorded in `createdIds`. Upserts that updated existing
 * rows (matched by external id, SKU, etc.) are silently left in their
 * post-migration state. Calling rollback on a real migration would
 * therefore leave the customer in an inconsistent partial-revert
 * state — worse than no rollback at all.
 *
 * Until snapshot-based rollback ships, every call returns HTTP 501
 * with `code: "NOT_IMPLEMENTED"`. We still enforce auth + capability
 * + ownership checks first so the endpoint never leaks job existence
 * to unauthorized callers, and we record an audit row so support can
 * see who attempted to roll back.
 *
 * Manual remediation: support resets the org from a pre-migration
 * backup (see runbook).
 */

import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
// P1-2: rollback engine deliberately NOT imported here.
// import { rollbackMigration } from "@/lib/migrations/core/rollback";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";
import { NextResponse } from "next/server";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
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

    // Verify the job belongs to this organization — never let an
    // unauthorized caller learn whether a job id exists.
    const job = await db.migrationJob.findUnique({
      where: { id: migrationJobId },
    });

    if (!job) {
      return NextResponse.json({ error: "Migration job not found" }, { status: 404 });
    }

    if (job.organizationId !== membership.organizationId) {
      return NextResponse.json({ error: "Organization mismatch" }, { status: 404 });
    }

    // Record the refusal so support has visibility into who attempted
    // a rollback — useful when triaging "but the UI used to let me do
    // this" tickets.
    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "migration.rollback_refused",
      entityType: "migration_job",
      entityId: migrationJobId,
      metadata: {
        reason: "NOT_IMPLEMENTED",
        audit: "v1.0 §5.7 P1-2",
        previousStatus: job.status,
      },
    });

    // P1-2: refuse the rollback. Engine is intentionally not invoked.
    return NextResponse.json(
      {
        error:
          "Migration rollback is not available in v1. Migrations are one-way; " +
          "contact support for manual remediation from a pre-migration backup.",
        code: "NOT_IMPLEMENTED",
      },
      { status: 501 },
    );
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
