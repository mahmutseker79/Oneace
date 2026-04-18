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
// P1-2 (audit v1.0 §5.7): rollbackMigration deliberately NOT imported.
// The engine has an updatedIds gap; the action below refuses all calls.
// import { rollbackMigration } from "@/lib/migrations/core/rollback";
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
    // P1-2: rollback is suspended for v1; importing jobs must run to
    // completion (or fail) before they can be cancelled. Manual
    // remediation is the only path to undo a completed import.
    throw new Error(
      "Cannot cancel during import. Wait for the import to complete or fail.",
    );
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

  // IMPORTANT: Vercel serverless functions die as soon as the handler
  // returns, so fire-and-forget (`void async IIFE`) silently drops the
  // import. Await the full import so the client gets a real completion.
  // For small files (< a few MB) this finishes within Vercel's 30s
  // function budget. Larger imports will need a proper job queue.
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
    throw err;
  }

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
//
// P1-2 (audit v1.0 §5.7): migration rollback is SUSPENDED for v1.
//
// The engine in `src/lib/migrations/core/rollback.ts` only reverts rows
// recorded in `createdIds` — upserts that *updated* existing rows
// (matched by external id, SKU, etc.) are silently left in their
// post-migration state. Calling rollback on a real migration would
// therefore leave the customer in an inconsistent partial-revert state
// that's worse than no rollback at all (some rows snap back to the
// pre-migration shape, others stay updated).
//
// Until snapshot-based rollback lands (full point-in-time restore for
// affected scopes), we refuse all rollback calls at the action and API
// boundaries. The engine code is preserved as dead-but-correct for
// when we ship the snapshot version.
//
// Manual remediation path: support resets the affected org from a
// pre-migration backup. Document this in the runbook.
// ─────────────────────────────────────────────────────────────────────────────

export class MigrationRollbackNotImplementedError extends Error {
  readonly code = "NOT_IMPLEMENTED";
  constructor() {
    super(
      "Migration rollback is not available in v1. Migrations are one-way; " +
        "contact support for manual remediation from a pre-migration backup.",
    );
    this.name = "MigrationRollbackNotImplementedError";
  }
}

export async function rollbackMigrationAction(
  id: string,
): Promise<{ success: boolean; code?: string }> {
  const { membership, session } = await requireActiveMembership();

  if (!hasCapability(membership.role, "migrations.rollback")) {
    throw new Error("Insufficient permissions");
  }

  // Verify ownership before recording the refusal — never let an
  // unauthorized caller learn whether a job id exists.
  const job = await db.migrationJob.findUnique({ where: { id } });
  if (!job) throw new Error("Migration not found");
  if (job.organizationId !== membership.organizationId) {
    throw new Error("Access denied");
  }

  await recordAudit({
    organizationId: membership.organizationId,
    actorId: session.user.id,
    action: "migration.rollback_refused",
    entityType: "migration_job",
    entityId: id,
    metadata: {
      reason: "NOT_IMPLEMENTED",
      audit: "v1.0 §5.7 P1-2",
      previousStatus: job.status,
    },
  });

  // We DO NOT call `rollbackMigration` here — the engine has the
  // updatedIds gap noted above. Throw with a stable code the UI and
  // tests can pin against.
  throw new MigrationRollbackNotImplementedError();
}
