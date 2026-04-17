/**
 * Phase MIG-S8 — Migration rollback engine.
 *
 * Undoes a completed or failed MigrationJob by deleting rows in reverse
 * dependency order: PURCHASE_ORDERS → ATTACHMENTS → STOCK_LEVELS →
 * CUSTOM_FIELD_VALUES → ITEMS → CUSTOM_FIELD_DEFS → LOCATIONS →
 * WAREHOUSES → SUPPLIERS → CATEGORIES.
 *
 * Safety guarantees:
 * - Tenant-scoped: all deletes filter by organizationId
 * - Provenance-scoped: entities without explicit createdIds are filtered
 *   by externalSource to avoid deleting user-created rows
 * - Idempotent: re-running on an already-rolled-back job no-ops
 * - Preserves MigrationJob for audit trail
 */

import type { ImportPhase, PhaseResult } from "@/lib/migrations/core/types";
import type { PrismaClient } from "@/generated/prisma";
import { recordAudit } from "@/lib/audit";

export interface RollbackResult {
  migrationJobId: string;
  startedAt: string;
  completedAt: string;
  deletedCounts: Record<ImportPhase, number>;
  errors: Array<{ phase: ImportPhase; entityId: string; message: string }>;
  success: boolean;
}

/**
 * Rolls back a completed or failed migration by deleting all rows it created.
 *
 * @throws Error if status is PENDING, IMPORTING, or VALIDATING (wrong lifecycle)
 * @throws Error if organizationId does not match
 * @throws Error if importResults cannot be parsed
 */
export async function rollbackMigration(opts: {
  db: PrismaClient;
  migrationJobId: string;
  organizationId: string;
  userId: string;
  force?: boolean;
}): Promise<RollbackResult> {
  const startedAt = new Date().toISOString();
  const deletedCounts: Record<ImportPhase, number> = {
    CATEGORIES: 0,
    SUPPLIERS: 0,
    WAREHOUSES: 0,
    LOCATIONS: 0,
    CUSTOM_FIELD_DEFS: 0,
    ITEMS: 0,
    CUSTOM_FIELD_VALUES: 0,
    STOCK_LEVELS: 0,
    ATTACHMENTS: 0,
    PURCHASE_ORDERS: 0,
  };
  const errors: Array<{ phase: ImportPhase; entityId: string; message: string }> = [];

  // Fetch the job; assert organization match.
  const job = await opts.db.migrationJob.findUnique({
    where: { id: opts.migrationJobId },
  });
  if (!job) {
    throw new Error(`MigrationJob not found: ${opts.migrationJobId}`);
  }
  if (job.organizationId !== opts.organizationId) {
    throw new Error(
      `Organization mismatch: job org=${job.organizationId}, expected=${opts.organizationId}`,
    );
  }

  // Check status: allow COMPLETED or FAILED only.
  // IMPORTING/VALIDATING need CANCEL, not rollback.
  if (
    job.status !== "COMPLETED" &&
    job.status !== "FAILED" &&
    job.status !== "CANCELLED"
  ) {
    throw new Error(
      `Cannot rollback job with status=${job.status}. ` +
        "Only COMPLETED, FAILED, or CANCELLED jobs can be rolled back.",
    );
  }

  // If already rolled back (status CANCELLED + notes contains [rollback]),
  // return success with zero counts.
  if (job.status === "CANCELLED" && job.notes?.includes("[rollback]")) {
    return {
      migrationJobId: opts.migrationJobId,
      startedAt,
      completedAt: new Date().toISOString(),
      deletedCounts,
      errors: [],
      success: true,
    };
  }

  // Parse importResults JSON. Expected shape: { version: 1, phases: PhaseResult[] }
  let phases: PhaseResult[] = [];
  if (job.importResults && typeof job.importResults === "object") {
    const importResults = job.importResults as { version?: number; phases?: PhaseResult[] };
    if (importResults.version === 1 && Array.isArray(importResults.phases)) {
      phases = importResults.phases;
    }
  }

  if (phases.length === 0) {
    throw new Error(
      `Cannot parse importResults: expected { version: 1, phases: PhaseResult[] }`,
    );
  }

  // Reverse phase order: delete in the opposite order they were created.
  const reversePhases = phases.slice().reverse();

  for (const phase of reversePhases) {
    try {
      switch (phase.phase) {
        case "PURCHASE_ORDERS":
          deletedCounts.PURCHASE_ORDERS = await rollbackPhase({
            db: opts.db,
            phase: "PURCHASE_ORDERS",
            createdIds: phase.createdIds,
            organizationId: opts.organizationId,
            sourcePlatform: job.sourcePlatform,
            errors,
          });
          break;

        case "ATTACHMENTS":
          deletedCounts.ATTACHMENTS = await rollbackPhase({
            db: opts.db,
            phase: "ATTACHMENTS",
            createdIds: phase.createdIds,
            organizationId: opts.organizationId,
            sourcePlatform: job.sourcePlatform,
            errors,
          });
          break;

        case "STOCK_LEVELS":
          deletedCounts.STOCK_LEVELS = await rollbackPhase({
            db: opts.db,
            phase: "STOCK_LEVELS",
            createdIds: phase.createdIds,
            organizationId: opts.organizationId,
            sourcePlatform: job.sourcePlatform,
            errors,
          });
          break;

        case "CUSTOM_FIELD_VALUES":
          deletedCounts.CUSTOM_FIELD_VALUES = await rollbackPhase({
            db: opts.db,
            phase: "CUSTOM_FIELD_VALUES",
            createdIds: phase.createdIds,
            organizationId: opts.organizationId,
            sourcePlatform: job.sourcePlatform,
            errors,
          });
          break;

        case "ITEMS":
          deletedCounts.ITEMS = await rollbackPhase({
            db: opts.db,
            phase: "ITEMS",
            createdIds: phase.createdIds,
            organizationId: opts.organizationId,
            sourcePlatform: job.sourcePlatform,
            errors,
          });
          break;

        case "CUSTOM_FIELD_DEFS":
          deletedCounts.CUSTOM_FIELD_DEFS = await rollbackPhase({
            db: opts.db,
            phase: "CUSTOM_FIELD_DEFS",
            createdIds: phase.createdIds,
            organizationId: opts.organizationId,
            sourcePlatform: job.sourcePlatform,
            errors,
          });
          break;

        case "LOCATIONS":
          deletedCounts.LOCATIONS = await rollbackPhase({
            db: opts.db,
            phase: "LOCATIONS",
            createdIds: phase.createdIds,
            organizationId: opts.organizationId,
            sourcePlatform: job.sourcePlatform,
            errors,
          });
          break;

        case "WAREHOUSES":
          deletedCounts.WAREHOUSES = await rollbackPhase({
            db: opts.db,
            phase: "WAREHOUSES",
            createdIds: phase.createdIds,
            organizationId: opts.organizationId,
            sourcePlatform: job.sourcePlatform,
            errors,
          });
          break;

        case "SUPPLIERS":
          deletedCounts.SUPPLIERS = await rollbackPhase({
            db: opts.db,
            phase: "SUPPLIERS",
            createdIds: phase.createdIds,
            organizationId: opts.organizationId,
            sourcePlatform: job.sourcePlatform,
            errors,
          });
          break;

        case "CATEGORIES":
          deletedCounts.CATEGORIES = await rollbackPhase({
            db: opts.db,
            phase: "CATEGORIES",
            createdIds: phase.createdIds,
            organizationId: opts.organizationId,
            sourcePlatform: job.sourcePlatform,
            errors,
          });
          break;
      }
    } catch (err) {
      // Phase-level error; log it but continue with other phases.
      const message = err instanceof Error ? err.message : String(err);
      // Record a generic error for this phase.
      errors.push({
        phase: phase.phase,
        entityId: "phase-level",
        message,
      });
    }
  }

  // Update the job: mark as CANCELLED and append rollback timestamp to notes.
  const rollbackTimestamp = new Date().toISOString();
  const notesSuffix =
    `\n[rollback] ${rollbackTimestamp} by user ${opts.userId}` +
    ` — ${Object.values(deletedCounts).reduce((a, b) => a + b, 0)} total rows deleted`;
  const updatedNotes = (job.notes ?? "") + notesSuffix;

  await opts.db.migrationJob.update({
    where: { id: opts.migrationJobId },
    data: {
      status: "CANCELLED",
      notes: updatedNotes,
    },
  });

  // Audit fix (Critical-2): emit the rollback event. `recordAudit`
  // swallows its own errors internally (see src/lib/audit.ts), so this
  // call is safe to await without wrapping — a failing audit write
  // must never fail the rollback itself.
  const totalDeleted = Object.values(deletedCounts).reduce((a, b) => a + b, 0);
  await recordAudit({
    organizationId: opts.organizationId,
    actorId: opts.userId,
    action: "migration.rollback",
    entityType: "migration_job",
    entityId: opts.migrationJobId,
    metadata: {
      source: job.sourcePlatform,
      deletedCounts,
      totalDeleted,
      errorCount: errors.length,
    },
  });

  const completedAt = new Date().toISOString();
  return {
    migrationJobId: opts.migrationJobId,
    startedAt,
    completedAt,
    deletedCounts,
    errors,
    success: errors.length === 0,
  };
}

interface RollbackPhaseContext {
  db: PrismaClient;
  phase: ImportPhase;
  createdIds: string[];
  organizationId: string;
  sourcePlatform: string;
  errors: Array<{ phase: ImportPhase; entityId: string; message: string }>;
}

async function rollbackPhase(ctx: RollbackPhaseContext): Promise<number> {
  // Each phase runs in its own transaction (5-minute timeout).
  return await ctx.db.$transaction(
    async (trx) => {
      let deleted = 0;

      switch (ctx.phase) {
        case "PURCHASE_ORDERS":
          deleted = await trx.purchaseOrder.deleteMany({
            where: {
              organizationId: ctx.organizationId,
              id: { in: ctx.createdIds },
            },
          }).then((r) => r.count);
          break;

        case "ATTACHMENTS":
          deleted = await trx.itemAttachment.deleteMany({
            where: {
              organizationId: ctx.organizationId,
              id: { in: ctx.createdIds },
            },
          }).then((r) => r.count);
          // TODO: delete blobs from Vercel Blob Storage.
          // Blob cleanup is a separate concern. For now we leave the files in Vercel
          // and only delete the database rows. A future job can sweep unreferenced blobs.
          break;

        case "STOCK_LEVELS":
          deleted = await trx.stockLevel.deleteMany({
            where: {
              organizationId: ctx.organizationId,
              id: { in: ctx.createdIds },
            },
          }).then((r) => r.count);
          break;

        case "CUSTOM_FIELD_VALUES":
          deleted = await trx.itemCustomFieldValue.deleteMany({
            where: {
              organizationId: ctx.organizationId,
              id: { in: ctx.createdIds },
            },
          }).then((r) => r.count);
          break;

        case "ITEMS":
          deleted = await trx.item.deleteMany({
            where: {
              organizationId: ctx.organizationId,
              id: { in: ctx.createdIds },
            },
          }).then((r) => r.count);
          break;

        case "CUSTOM_FIELD_DEFS":
          // Filter by externalSource to avoid deleting user-created definitions.
          if (ctx.createdIds.length > 0) {
            const defs = await trx.customFieldDefinition.findMany({
              where: {
                organizationId: ctx.organizationId,
                id: { in: ctx.createdIds },
              },
              select: { id: true, externalSource: true },
            });
            const idsToDelete = defs
              .filter((d) => d.externalSource === ctx.sourcePlatform)
              .map((d) => d.id);
            deleted = await trx.customFieldDefinition.deleteMany({
              where: { id: { in: idsToDelete } },
            }).then((r) => r.count);
          }
          break;

        case "LOCATIONS":
          // Filter by externalSource.
          if (ctx.createdIds.length > 0) {
            const locs = await trx.location.findMany({
              where: {
                organizationId: ctx.organizationId,
                id: { in: ctx.createdIds },
              },
              select: { id: true, externalSource: true },
            });
            const idsToDelete = locs
              .filter((l) => l.externalSource === ctx.sourcePlatform)
              .map((l) => l.id);
            deleted = await trx.location.deleteMany({
              where: { id: { in: idsToDelete } },
            }).then((r) => r.count);
          }
          break;

        case "WAREHOUSES":
          // Filter by externalSource.
          if (ctx.createdIds.length > 0) {
            const whse = await trx.warehouse.findMany({
              where: {
                organizationId: ctx.organizationId,
                id: { in: ctx.createdIds },
              },
              select: { id: true, externalSource: true },
            });
            const idsToDelete = whse
              .filter((w) => w.externalSource === ctx.sourcePlatform)
              .map((w) => w.id);
            deleted = await trx.warehouse.deleteMany({
              where: { id: { in: idsToDelete } },
            }).then((r) => r.count);
          }
          break;

        case "SUPPLIERS":
          // Filter by externalSource.
          if (ctx.createdIds.length > 0) {
            const supp = await trx.supplier.findMany({
              where: {
                organizationId: ctx.organizationId,
                id: { in: ctx.createdIds },
              },
              select: { id: true, externalSource: true },
            });
            const idsToDelete = supp
              .filter((s) => s.externalSource === ctx.sourcePlatform)
              .map((s) => s.id);
            deleted = await trx.supplier.deleteMany({
              where: { id: { in: idsToDelete } },
            }).then((r) => r.count);
          }
          break;

        case "CATEGORIES":
          // Filter by externalSource.
          if (ctx.createdIds.length > 0) {
            const cats = await trx.category.findMany({
              where: {
                organizationId: ctx.organizationId,
                id: { in: ctx.createdIds },
              },
              select: { id: true, externalSource: true },
            });
            const idsToDelete = cats
              .filter((c) => c.externalSource === ctx.sourcePlatform)
              .map((c) => c.id);
            deleted = await trx.category.deleteMany({
              where: { id: { in: idsToDelete } },
            }).then((r) => r.count);
          }
          break;
      }

      return deleted;
    },
    { timeout: 5 * 60 * 1000 },
  ).catch((err) => {
    // Transaction error — record and continue.
    const message = err instanceof Error ? err.message : String(err);
    ctx.errors.push({
      phase: ctx.phase,
      entityId: "transaction-error",
      message,
    });
    return 0;
  });
}
