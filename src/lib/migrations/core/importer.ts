/**
 * Phase MIG-S1 — Migration import orchestrator (skeleton).
 *
 * Takes a {@link ParsedSnapshot} produced by an adapter (Sortly / inFlow /
 * Fishbowl / Cin7 Core / SOS Inventory) and writes it into OneAce in the
 * precise order that satisfies all foreign-key dependencies:
 *
 *    Phase 1: CATEGORIES              (topologically sorted; self-FK)
 *    Phase 2: SUPPLIERS + WAREHOUSES  (independent of each other)
 *    Phase 3: LOCATIONS               (needs warehouses)
 *    Phase 4: CUSTOM_FIELD_DEFS       (needs org; schema for item attrs)
 *    Phase 5: ITEMS                   (needs categories + suppliers)
 *    Phase 6: CUSTOM_FIELD_VALUES     (needs items + defs)
 *    Phase 7: STOCK_LEVELS            (needs items + warehouses)
 *    Phase 8: ATTACHMENTS             (needs items; uploads to Vercel Blob)
 *    Phase 9: PURCHASE_ORDERS         (needs items + suppliers)
 *
 * Each phase runs in its own Prisma transaction. If a phase fails the
 * orchestrator stops short-circuits: it writes a PhaseResult with the
 * failure, marks the MigrationJob as FAILED, and lets the caller decide
 * whether to rollback previously-completed phases.
 *
 * THIS IS THE S1 SKELETON. The phase implementations will be filled in
 * during S2 (CSV pipeline for Sortly + inFlow) and later sprints. The
 * orchestrator's public contract is stable now so adapters can be
 * written against it without waiting for the internals.
 */
import type { MigrationStatus, PrismaClient } from "@/generated/prisma";

import { recordAudit } from "@/lib/audit";
import { IdMap } from "@/lib/migrations/core/id-map";
import { importAttachmentsPhase } from "@/lib/migrations/core/phases/attachments";
import { importCategories } from "@/lib/migrations/core/phases/categories";
import { importCustomFieldDefs } from "@/lib/migrations/core/phases/custom-field-defs";
import { importCustomFieldValues } from "@/lib/migrations/core/phases/custom-field-values";
import { importItems } from "@/lib/migrations/core/phases/items";
import { importLocations } from "@/lib/migrations/core/phases/locations";
import { importPurchaseOrders } from "@/lib/migrations/core/phases/purchase-orders";
import { importStockLevels } from "@/lib/migrations/core/phases/stock-levels";
import { importSuppliers } from "@/lib/migrations/core/phases/suppliers";
import { importWarehouses } from "@/lib/migrations/core/phases/warehouses";
import {
  type MigrationScopeOptions,
  parseScopeOptions,
  resolvePoHistoryCutoff,
  shouldImportPurchaseOrders,
} from "@/lib/migrations/core/scope-options";
import type {
  ImportPhase,
  MigrationImportResult,
  ParsedSnapshot,
  PhaseResult,
} from "@/lib/migrations/core/types";

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export interface RunImportOptions {
  db: PrismaClient;
  migrationJobId: string;
  organizationId: string;
  snapshot: ParsedSnapshot;
  /**
   * Override scope options. Normally the orchestrator reads them from
   * `MigrationJob.scopeOptions` on disk; tests and resumed jobs pass
   * an explicit value.
   */
  scopeOptions?: MigrationScopeOptions;
  /**
   * Optional progress callback — invoked after each phase completes
   * (both on success and failure). Lets the UI stream progress.
   */
  onPhaseComplete?: (result: PhaseResult) => void | Promise<void>;
  /**
   * Optional user ID for audit logging. If provided, audit events are
   * emitted at migration start and completion. If not provided, audit
   * events are skipped.
   */
  auditUserId?: string | null;
}

/**
 * Run a full migration. Always returns a {@link MigrationImportResult};
 * partial failures are reflected in `success=false` and per-phase
 * reports, not thrown.
 */
export async function runMigrationImport(opts: RunImportOptions): Promise<MigrationImportResult> {
  const startedAt = new Date();

  // Resolve scope options: prefer explicit override, else load from DB,
  // else defaults. Validation is strict — a malformed scope is a bug.
  const scope = await resolveScope(opts);

  // Stamp PO history cutoff at start time so every phase sees the same
  // "now". This matters if the import spans minutes or restarts.
  if (scope.poHistory === "LAST_12_MONTHS" && !scope.dateRangeStart) {
    const cutoff = resolvePoHistoryCutoff("LAST_12_MONTHS", startedAt);
    if (cutoff) scope.dateRangeStart = cutoff.toISOString();
  }

  // Mark the job IMPORTING.
  await updateJobStatus(opts.db, opts.migrationJobId, "IMPORTING", {
    startedAt,
  });

  // Emit start audit event if auditUserId is provided.
  if (opts.auditUserId) {
    await recordAudit({
      organizationId: opts.organizationId,
      actorId: opts.auditUserId,
      action: "migration.started",
      entityType: "migration_job",
      entityId: opts.migrationJobId,
      metadata: {
        source: opts.snapshot.source,
        itemCount: opts.snapshot.items.length,
        supplierCount: opts.snapshot.suppliers.length,
        warehouseCount: opts.snapshot.warehouses.length,
      },
    });
  }

  const idMap = new IdMap();
  const phaseResults: PhaseResult[] = [];
  let success = true;

  // Phase list — some phases are conditionally skipped based on scope.
  const plan: ImportPhase[] = ["CATEGORIES", "SUPPLIERS", "WAREHOUSES", "LOCATIONS"];
  if (scope.includeCustomFields) plan.push("CUSTOM_FIELD_DEFS");
  plan.push("ITEMS");
  if (scope.includeCustomFields) plan.push("CUSTOM_FIELD_VALUES");
  plan.push("STOCK_LEVELS");
  if (scope.includeAttachments) plan.push("ATTACHMENTS");
  if (shouldImportPurchaseOrders(scope)) plan.push("PURCHASE_ORDERS");

  for (const phase of plan) {
    const result = await runPhase({
      phase,
      db: opts.db,
      organizationId: opts.organizationId,
      migrationJobId: opts.migrationJobId,
      snapshot: opts.snapshot,
      scope,
      idMap,
    });
    phaseResults.push(result);
    if (opts.onPhaseComplete) await opts.onPhaseComplete(result);

    if (result.failed > 0 && result.errors.some((e) => e.severity === "ERROR")) {
      success = false;
      break;
    }
  }

  const completedAt = new Date();

  // Write importResults snapshot back to the job for rollback / audit.
  await opts.db.migrationJob.update({
    where: { id: opts.migrationJobId },
    data: {
      status: success ? "COMPLETED" : "FAILED",
      completedAt,
      importResults: serializeResults(phaseResults) as unknown as object,
    },
  });

  // Emit completion audit event if auditUserId is provided.
  const totals = summarizeTotals(phaseResults, opts.snapshot);
  if (opts.auditUserId) {
    await recordAudit({
      organizationId: opts.organizationId,
      actorId: opts.auditUserId,
      action: success ? "migration.completed" : "migration.failed",
      entityType: "migration_job",
      entityId: opts.migrationJobId,
      metadata: {
        success,
        itemsCreated: totals.items,
        categoriesCreated: totals.categories,
        suppliersCreated: totals.suppliers,
        warehousesCreated: totals.warehouses,
        stockLevelsCreated: totals.stockLevels,
        attachmentsCreated: totals.attachments,
        purchaseOrdersCreated: totals.purchaseOrders,
        totalPhases: phaseResults.length,
        failedPhaseCount: phaseResults.filter((r) => r.failed > 0).length,
      },
    });
  }

  return {
    success,
    migrationJobId: opts.migrationJobId,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    phases: phaseResults,
    totals,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Internals (skeleton — filled in during S2+)
// ─────────────────────────────────────────────────────────────────────────────

export interface PhaseContext {
  phase: ImportPhase;
  db: PrismaClient;
  organizationId: string;
  migrationJobId: string;
  snapshot: ParsedSnapshot;
  scope: MigrationScopeOptions;
  idMap: IdMap;
}

/**
 * Dispatch to a phase-specific importer.
 */
async function runPhase(ctx: PhaseContext): Promise<PhaseResult> {
  const startedAt = new Date();
  let created = 0;
  let updated = 0;
  let failed = 0;
  let createdIds: string[] = [];
  let errors: any[] = [];

  try {
    switch (ctx.phase) {
      case "CATEGORIES":
        ({ created, updated, failed, createdIds, errors } = await importCategories(ctx));
        break;
      case "SUPPLIERS":
        ({ created, updated, failed, createdIds, errors } = await importSuppliers(ctx));
        break;
      case "WAREHOUSES":
        ({ created, updated, failed, createdIds, errors } = await importWarehouses(ctx));
        break;
      case "LOCATIONS":
        ({ created, updated, failed, createdIds, errors } = await importLocations(ctx));
        break;
      case "CUSTOM_FIELD_DEFS":
        ({ created, updated, failed, createdIds, errors } = await importCustomFieldDefs(ctx));
        break;
      case "ITEMS":
        ({ created, updated, failed, createdIds, errors } = await importItems(ctx));
        break;
      case "CUSTOM_FIELD_VALUES":
        ({ created, updated, failed, createdIds, errors } = await importCustomFieldValues(ctx));
        break;
      case "STOCK_LEVELS":
        ({ created, updated, failed, createdIds, errors } = await importStockLevels(ctx));
        break;
      case "PURCHASE_ORDERS":
        ({ created, updated, failed, createdIds, errors } = await importPurchaseOrders(ctx));
        break;
      case "ATTACHMENTS":
        ({ created, updated, failed, createdIds, errors } = await importAttachmentsPhase(ctx));
        break;
      default: {
        const _exhaustive: never = ctx.phase;
        return _exhaustive;
      }
    }
  } catch (e) {
    failed++;
    errors.push({
      severity: "ERROR",
      code: "PHASE_FATAL",
      message: `Phase ${ctx.phase} failed fatally: ${e instanceof Error ? e.message : String(e)}`,
    });
  }

  const completedAt = new Date();
  return {
    phase: ctx.phase,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    created,
    updated,
    skipped: Math.max(0, countSnapshotRows(ctx.phase, ctx.snapshot) - created - updated - failed),
    failed,
    createdIds,
    errors,
  };
}

/**
 * How many rows of this phase's entity are in the snapshot.
 * Used by the skeleton to report "skipped" counts so the UI can show
 * real numbers during development.
 */
function countSnapshotRows(phase: ImportPhase, snap: ParsedSnapshot): number {
  switch (phase) {
    case "CATEGORIES":
      return snap.categories.length;
    case "SUPPLIERS":
      return snap.suppliers.length;
    case "WAREHOUSES":
      return snap.warehouses.length;
    case "LOCATIONS":
      return snap.locations.length;
    case "CUSTOM_FIELD_DEFS":
      return snap.customFieldDefs.length;
    case "ITEMS":
      return snap.items.length;
    case "CUSTOM_FIELD_VALUES":
      return snap.items.reduce((acc, i) => acc + Object.keys(i.customFieldValues ?? {}).length, 0);
    case "STOCK_LEVELS":
      return snap.stockLevels.length;
    case "ATTACHMENTS":
      return snap.attachments.length;
    case "PURCHASE_ORDERS":
      return snap.purchaseOrders.length;
  }
}

async function resolveScope(opts: RunImportOptions): Promise<MigrationScopeOptions> {
  if (opts.scopeOptions) return opts.scopeOptions;
  const job = await opts.db.migrationJob.findUniqueOrThrow({
    where: { id: opts.migrationJobId },
    select: { scopeOptions: true },
  });
  return parseScopeOptions(job.scopeOptions ?? {});
}

async function updateJobStatus(
  db: PrismaClient,
  id: string,
  status: MigrationStatus,
  extra: { startedAt?: Date; completedAt?: Date } = {},
): Promise<void> {
  await db.migrationJob.update({
    where: { id },
    data: {
      status,
      ...(extra.startedAt ? { startedAt: extra.startedAt } : {}),
      ...(extra.completedAt ? { completedAt: extra.completedAt } : {}),
    },
  });
}

function serializeResults(results: PhaseResult[]): unknown {
  return {
    version: 1,
    phases: results,
  };
}

function summarizeTotals(
  results: PhaseResult[],
  snap: ParsedSnapshot,
): MigrationImportResult["totals"] {
  const totalFor = (phase: ImportPhase): number =>
    results.find((r) => r.phase === phase)?.created ?? 0;

  return {
    items: totalFor("ITEMS"),
    categories: totalFor("CATEGORIES"),
    suppliers: totalFor("SUPPLIERS"),
    warehouses: totalFor("WAREHOUSES"),
    locations: totalFor("LOCATIONS"),
    stockLevels: totalFor("STOCK_LEVELS"),
    purchaseOrders: totalFor("PURCHASE_ORDERS"),
    attachments: totalFor("ATTACHMENTS"),
    customFieldDefs: totalFor("CUSTOM_FIELD_DEFS"),
    customFieldValues: totalFor("CUSTOM_FIELD_VALUES"),
    // Snapshot-level sanity check — callers can compare against the
    // above and spot phases that reported 0 when the snapshot had rows.
    ...{ _snapshotItemCount: snap.items.length },
  } as MigrationImportResult["totals"];
}
