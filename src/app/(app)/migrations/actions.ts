/**
 * Phase MIG-S2 — Server actions for the migrations UI.
 *
 * Thin wrappers around the HTTP API routes, scoped to one organization.
 * Used by both the onboarding Step 3 wizard and the migrations hub pages.
 */

"use server";

import { db } from "@/lib/db";
import { requireActiveMembership } from "@/lib/session";
import { hasCapability } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type {
  MigrationSource,
  MigrationStatus,
} from "@/generated/prisma";
import type { FieldMapping } from "@/lib/migrations/core/types";
import {
  defaultScopeOptions,
  parseScopeOptions,
  type MigrationScopeOptions,
} from "@/lib/migrations/core/scope-options";
import { rollbackMigration } from "@/lib/migrations/core/rollback";
import { getAdapterFor } from "@/lib/migrations/core/adapter";
import { loadStoredFiles } from "@/lib/migrations/core/source-file-store";
import { runMigrationImport } from "@/lib/migrations/core/importer";

// ─────────────────────────────────────────────────────────────────────────────
// createMigrationJobAction
// ─────────────────────────────────────────────────────────────────────────────

export async function createMigrationJobAction(
  source: MigrationSource
): Promise<{ id: string }> {
  const { membership, user } = await requireActiveMembership();

  if (!hasCapability(membership.role, "integrations.connect")) {
    throw new Error("Insufficient permissions");
  }

  const job = await db.migrationJob.create({
    data: {
      organizationId: membership.organizationId,
      sourcePlatform: source,
      status: "PENDING" as const,
      createdById: user.id,
    },
  });

  await recordAudit({
    db,
    organizationId: membership.organizationId,
    action: "migration.created",
    actor: user,
    entity: { type: "MigrationJob", id: job.id },
    metadata: { source },
  });

  revalidatePath("/migrations");

  return { id: job.id };
}

// ─────────────────────────────────────────────────────────────────────────────
// deleteMigrationJobAction
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteMigrationJobAction(
  id: string
): Promise<{ success: boolean }> {
  const { membership, user } = await requireActiveMembership();

  if (!hasCapability(membership.role, "integrations.connect")) {
    throw new Error("Insufficient permissions");
  }

  const job = await db.migrationJob.findUnique({
    where: { id },
  });

  if (!job) {
    throw new Error("Migration not found");
  }

  if (job.organizationId !== membership.organizationId) {
    throw new Error("Access denied");
  }

  const DELETABLE_STATES: MigrationStatus[] = [
    "PENDING",
    "FILES_UPLOADED",
    "MAPPING_REVIEW",
    "VALIDATING",
    "VALIDATED",
    "FAILED",
    "CANCELLED",
  ];

  if (!DELETABLE_STATES.includes(job.status)) {
    throw new Error(`Cannot delete migration in ${job.status} state`);
  }

  await db.migrationJob.update({
    where: { id },
    data: {
      status: "CANCELLED" as const,
      cancelledAt: new Date(),
      notes: "Deleted by user",
    },
  });

  await recordAudit({
    db,
    organizationId: membership.organizationId,
    action: "migration.deleted",
    actor: user,
    entity: { type: "MigrationJob", id },
    metadata: { previousStatus: job.status },
  });

  revalidatePath("/migrations");

  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// cancelMigrationJobAction
// ─────────────────────────────────────────────────────────────────────────────

export async function cancelMigrationJobAction(
  id: string
): Promise<{ success: boolean }> {
  const { membership, user } = await requireActiveMembership();

  if (!hasCapability(membership.role, "integrations.connect")) {
    throw new Error("Insufficient permissions");
  }

  const job = await db.migrationJob.findUnique({
    where: { id },
  });

  if (!job) {
    throw new Error("Migration not found");
  }

  if (job.organizationId !== membership.organizationId) {
    throw new Error("Access denied");
  }

  if (job.status === "IMPORTING") {
    throw new Error(
      "Cannot cancel during import. Use rollback after completion."
    );
  }

  if (["COMPLETED", "CANCELLED"].includes(job.status)) {
    throw new Error("Migration is already in a terminal state");
  }

  await db.migrationJob.update({
    where: { id },
    data: {
      status: "CANCELLED" as const,
      cancelledAt: new Date(),
      notes: "Cancelled by user",
    },
  });

  await recordAudit({
    db,
    organizationId: membership.organizationId,
    action: "migration.cancelled",
    actor: user,
    entity: { type: "MigrationJob", id },
    metadata: { previousStatus: job.status },
  });

  revalidatePath("/migrations");

  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// saveMappingAction
// ─────────────────────────────────────────────────────────────────────────────

export async function saveMappingAction(
  id: string,
  payload: {
    fieldMappings: FieldMapping[];
    scopeOptions?: MigrationScopeOptions;
  }
): Promise<{ success: boolean }> {
  const { membership, user } = await requireActiveMembership();

  if (!hasCapability(membership.role, "integrations.connect")) {
    throw new Error("Insufficient permissions");
  }

  const job = await db.migrationJob.findUnique({
    where: { id },
  });

  if (!job) {
    throw new Error("Migration not found");
  }

  if (job.organizationId !== membership.organizationId) {
    throw new Error("Access denied");
  }

  if (!["MAPPING_REVIEW", "VALIDATED"].includes(job.status)) {
    throw new Error(
      `Cannot edit mapping in ${job.status} state`
    );
  }

  const updateData: any = {
    fieldMappings: payload.fieldMappings,
  };

  if (payload.scopeOptions) {
    updateData.scopeOptions = payload.scopeOptions;
  }

  await db.migrationJob.update({
    where: { id },
    data: updateData,
  });

  await recordAudit({
    db,
    organizationId: membership.organizationId,
    action: "migration.mapping_saved",
    actor: user,
    entity: { type: "MigrationJob", id },
    metadata: { fieldMappingCount: payload.fieldMappings.length },
  });

  revalidatePath("/migrations");

  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// startMigrationAction
// ─────────────────────────────────────────────────────────────────────────────

export async function startMigrationAction(
  id: string
): Promise<{ success: boolean }> {
  const { membership, user } = await requireActiveMembership();

  if (!hasCapability(membership.role, "integrations.connect")) {
    throw new Error("Insufficient permissions");
  }

  const job = await db.migrationJob.findUnique({
    where: { id },
  });

  if (!job) {
    throw new Error("Migration not found");
  }

  if (job.organizationId !== membership.organizationId) {
    throw new Error("Access denied");
  }

  if (!["VALIDATED", "FAILED"].includes(job.status)) {
    throw new Error(
      "Migration must be validated before starting"
    );
  }

  // Audit fix (High-4): previously this server action called fetch() to
  // its own /api/migrations/[id]/start route. Cookies don't forward
  // reliably across that internal hop on some hosts, and it doubles the
  // round-trip cost. Call the same logic directly: flip the job to
  // IMPORTING, then kick off `runMigrationImport` in a void closure.
  // The HTTP route remains available for external callers and tests.
  await db.migrationJob.update({
    where: { id },
    data: { status: "IMPORTING", startedAt: new Date() },
  });

  const uploadedFiles = await loadStoredFiles(
    { db },
    membership.organizationId,
    id,
  );
  const scope = parseScopeOptions(job.scopeOptions ?? defaultScopeOptions());
  const fieldMappings = (job.fieldMappings ?? {}) as Record<string, unknown>;
  if (
    fieldMappings.credentials &&
    typeof fieldMappings.credentials === "object"
  ) {
    (fieldMappings.credentials as Record<string, unknown>).organizationId =
      membership.organizationId;
  }

  void (async () => {
    try {
      const adapter = await getAdapterFor(job.sourcePlatform);
      const snapshot = await adapter.parse(uploadedFiles, fieldMappings);
      await runMigrationImport({
        db,
        migrationJobId: id,
        organizationId: membership.organizationId,
        snapshot,
        scopeOptions: scope,
        auditUserId: user.id,
      });
    } catch (err) {
      await db.migrationJob.update({
        where: { id },
        data: {
          status: "FAILED",
          notes: `Import error: ${err instanceof Error ? err.message : String(err)}`,
        },
      });
    }
  })();

  await recordAudit({
    organizationId: membership.organizationId,
    actorId: user.id,
    action: "migration.started",
    entityType: "migration_job",
    entityId: id,
    metadata: { source: job.sourcePlatform, via: "server-action" },
  });

  revalidatePath("/migrations");
  revalidatePath(`/migrations/${id}`);

  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// rollbackMigrationAction
// ─────────────────────────────────────────────────────────────────────────────

export async function rollbackMigrationAction(
  id: string
): Promise<{ success: boolean }> {
  const { membership, user } = await requireActiveMembership();

  if (!hasCapability(membership.role, "integrations.connect")) {
    throw new Error("Insufficient permissions");
  }

  const job = await db.migrationJob.findUnique({
    where: { id },
  });

  if (!job) {
    throw new Error("Migration not found");
  }

  if (job.organizationId !== membership.organizationId) {
    throw new Error("Access denied");
  }

  // Call the rollback function
  const result = await rollbackMigration({
    db,
    migrationJobId: id,
    organizationId: membership.organizationId,
    userId: user.id,
  });

  if (!result.success) {
    throw new Error("Rollback encountered errors");
  }

  // Update job status to CANCELLED
  await db.migrationJob.update({
    where: { id },
    data: {
      status: "CANCELLED" as const,
      cancelledAt: new Date(),
      notes: `Rolled back: ${result.deletedCounts.ITEMS} items, etc.`,
    },
  });

  await recordAudit({
    db,
    organizationId: membership.organizationId,
    action: "migration.rollback_complete",
    actor: user,
    entity: { type: "MigrationJob", id },
    metadata: { deletedCounts: result.deletedCounts },
  });

  revalidatePath("/migrations");

  return { success: true };
}
