/**
 * Phase MIG-S2 — Server actions for the migrations UI.
 *
 * Thin wrappers around the HTTP API routes, scoped to one organization.
 * Used by both the onboarding Step 3 wizard and the migrations hub pages.
 *
 * Schema note: MigrationJob has no `cancelledAt` column. Cancellation is
 * tracked by { status: "CANCELLED", notes: "..." } + `updatedAt` (auto).
 * Also no `detectedFiles` / `snapshot` column — those live inside
 * `fieldMappings` or `importResults` JSON.
 */

"use server";

import type { MigrationSource, MigrationStatus } from "@/generated/prisma";
import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getAdapterFor } from "@/lib/migrations/core/adapter";
import { runMigrationImport } from "@/lib/migrations/core/importer";
import { rollbackMigration } from "@/lib/migrations/core/rollback";
import {
  type MigrationScopeOptions,
  defaultScopeOptions,
  parseScopeOptions,
} from "@/lib/migrations/core/scope-options";
import { loadStoredFiles } from "@/lib/migrations/core/source-file-store";
import type { FieldMapping } from "@/lib/migrations/core/types";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";
import { revalidatePath } from "next/cache";

// ─────────────────────────────────────────────────────────────────────────────
// createMigrationJobAction
// ─────────────────────────────────────────────────────────────────────────────

export async function createMigrationJobAction(source: MigrationSource): Promise<{ id: string }> {
  const { membership, session } = await requireActiveMembership();

  if (!hasCapability(membership.role, "migrations.create")) {
    throw new Error("Insufficient permissions");
  }

  const job = await db.migrationJob.create({
    data: {
      organizationId: membership.organizationId,
      sourcePlatform: source,
      status: "PENDING",
      createdByUserId: session.user.id,
    },
  });

  await recordAudit({
    organizationId: membership.organizationId,
    actorId: session.user.id,
    action: "migration.created",
    entityType: "migration_job",
    entityId: job.id,
    metadata: { source },
  });

  revalidatePath("/migrations");

  return { id: job.id };
}

// ─────────────────────────────────────────────────────────────────────────────
// deleteMigrationJobAction (soft-cancel with notes marker)
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteMigrationJobAction(id: string): Promise<{ success: boolean }> {
  const { membership, session } = await requireActiveMembership();

  if (!hasCapability(membership.role, "migrations.delete")) {
    throw new Error("Insufficient permissions");
  }

  const job = await db.migrationJob.findUnique({ where: { id } });
  if (!job) throw new Error("Migration not found");
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
      status: "CANCELLED",
      notes: `Deleted by user at ${new Date().toISOString()}`,
    },
  });

  await recordAudit({
    organizationId: membership.organizationId,
    actorId: session.user.id,
    action: "migration.deleted",
    entityType: "migration_job",
    entityId: id,
    metadata: { previousStatus: job.status },
  });

  revalidatePath("/migrations");
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// cancelMigrationJobAction
// ─────────────────────────────────────────────────────────────────────────────

export async function cancelMigrationJobAction(id: string): Promise<{ success: boolean }> {
  const { membership, session } = await requireActiveMembership();

  if (!hasCapability(membership.role, "migrations.cancel")) {
    throw new Error("Insufficient permissions");
  }

  const job = await db.migrationJob.findUnique({ where: { id } });
  if (!job) throw new Error("Migration not found");
  if (job.organizationId !== membership.organizationId) {
    throw new Error("Access denied");
  }

  if (job.status === "IMPORTING") {
    throw new Error("Cannot cancel during import. Use rollback after completion.");
  }
  if (["COMPLETED", "CANCELLED"].includes(job.status)) {
    throw new Error("Migration is already in a terminal state");
  }

  await db.migrationJob.update({
    where: { id },
    data: {
      status: "CANCELLED",
      notes: `Cancelled by user at ${new Date().toISOString()}`,
    },
  });

  await recordAudit({
    organizationId: membership.organizationId,
    actorId: session.user.id,
    action: "migration.cancelled",
    entityType: "migration_job",
    entityId: id,
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
  },
): Promise<{ success: boolean }> {
  const { membership, session } = await requireActiveMembership();

  if (!hasCapability(membership.role, "migrations.create")) {
    throw new Error("Insufficient permissions");
  }

  const job = await db.migrationJob.findUnique({ where: { id } });
  if (!job) throw new Error("Migration not found");
  if (job.organizationId !== membership.organizationId) {
    throw new Error("Access denied");
  }

  if (!["MAPPING_REVIEW", "VALIDATED"].includes(job.status)) {
    throw new Error(`Cannot edit mapping in ${job.status} state`);
  }

  // fieldMappings is Json — store as object so we can nest mappings + credentials + detections
  const existingFm = (job.fieldMappings as Record<string, unknown>) ?? {};
  const nextFm = {
    ...existingFm,
    mappings: payload.fieldMappings,
  };

  const updateData: Record<string, unknown> = {
    fieldMappings: nextFm,
  };
  if (payload.scopeOptions) {
    updateData.scopeOptions = payload.scopeOptions;
  }

  await db.migrationJob.update({
    where: { id },
    // biome-ignore lint/suspicious/noExplicitAny: Prisma JSON update typing
    data: updateData as any,
  });

  await recordAudit({
    organizationId: membership.organizationId,
    actorId: session.user.id,
    action: "migration.mapping_saved",
    entityType: "migration_job",
    entityId: id,
    metadata: { fieldMappingCount: payload.fieldMappings.length },
  });

  revalidatePath("/migrations");
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// startMigrationAction
// ─────────────────────────────────────────────────────────────────────────────

export async function startMigrationAction(id: string): Promise<{ success: boolean }> {
  const { membership, session } = await requireActiveMembership();

  if (!hasCapability(membership.role, "migrations.start")) {
    throw new Error("Insufficient permissions");
  }

  const job = await db.migrationJob.findUnique({ where: { id } });
  if (!job) throw new Error("Migration not found");
  if (job.organizationId !== membership.organizationId) {
    throw new Error("Access denied");
  }

  if (!["VALIDATED", "FAILED"].includes(job.status)) {
    throw new Error("Migration must be validated before starting");
  }

  await db.migrationJob.update({
    where: { id },
    data: { status: "IMPORTING", startedAt: new Date() },
  });

  const uploadedFiles = await loadStoredFiles({ db }, membership.organizationId, id);
  const scope = parseScopeOptions(job.scopeOptions ?? defaultScopeOptions());
  const fieldMappings = (job.fieldMappings ?? {}) as Record<string, unknown>;
  if (fieldMappings.credentials && typeof fieldMappings.credentials === "object") {
    (fieldMappings.credentials as Record<string, unknown>).organizationId =
      membership.organizationId;
  }

  void (async () => {
    try {
      const adapter = await getAdapterFor(job.sourcePlatform);
      // biome-ignore lint/suspicious/noExplicitAny: adapter.parse signature varies by source
      const adapterAny = adapter as any;
      const snapshot = adapterAny.parseWithScope
        ? await adapterAny.parseWithScope(uploadedFiles, fieldMappings, scope)
        : await adapterAny.parse(uploadedFiles, fieldMappings);
      await runMigrationImport({
        db,
        migrationJobId: id,
        organizationId: membership.organizationId,
        snapshot,
        scopeOptions: scope,
        auditUserId: session.user.id,
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
    actorId: session.user.id,
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

export async function rollbackMigrationAction(id: string): Promise<{ success: boolean }> {
  const { membership, session } = await requireActiveMembership();

  if (!hasCapability(membership.role, "migrations.rollback")) {
    throw new Error("Insufficient permissions");
  }

  const job = await db.migrationJob.findUnique({ where: { id } });
  if (!job) throw new Error("Migration not found");
  if (job.organizationId !== membership.organizationId) {
    throw new Error("Access denied");
  }

  const result = await rollbackMigration({
    db,
    migrationJobId: id,
    organizationId: membership.organizationId,
    userId: session.user.id,
  });

  if (!result.success) {
    throw new Error("Rollback encountered errors");
  }

  await db.migrationJob.update({
    where: { id },
    data: {
      status: "CANCELLED",
      notes: `Rolled back by user at ${new Date().toISOString()} (items: ${result.deletedCounts.ITEMS ?? 0})`,
    },
  });

  await recordAudit({
    organizationId: membership.organizationId,
    actorId: session.user.id,
    action: "migration.rollback_complete",
    entityType: "migration_job",
    entityId: id,
    metadata: { deletedCounts: result.deletedCounts },
  });

  revalidatePath("/migrations");
  return { success: true };
}
