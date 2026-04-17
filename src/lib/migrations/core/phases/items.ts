/**
 * Phase MIG-S2 — ITEMS import phase.
 *
 * Imports items with SKU collision detection and resolution.
 * Uses upsertItemByExternal for idempotent upsert.
 */

import { upsertItemByExternal } from "@/lib/migrations/core/id-map";
import type { PhaseContext } from "@/lib/migrations/core/importer";

import type { ValidationIssue } from "@/lib/migrations/core/types";
export async function importItems(ctx: PhaseContext): Promise<{
  created: number;
  updated: number;
  failed: number;
  createdIds: string[];
  errors: ValidationIssue[];
}> {
  let created = 0;
  let updated = 0;
  const createdIds: string[] = [];
  const errors: ValidationIssue[] = [];

  const batchSize = 100;
  for (let i = 0; i < ctx.snapshot.items.length; i += batchSize) {
    const batch = ctx.snapshot.items.slice(i, i + batchSize);

    try {
      const result = await ctx.db.$transaction(async (tx) => {
        let bCreated = 0;
        let bUpdated = 0;

        for (const rawItem of batch) {
          try {
            // Resolve foreign keys with orphan detection (Phase S6).
            let categoryInternalId: string | null = null;
            if (rawItem.categoryExternalId) {
              categoryInternalId = ctx.idMap.get("CATEGORY", rawItem.categoryExternalId);
              if (!categoryInternalId) {
                // Orphan FK: category import failed or was skipped.
                errors.push({
                  severity: "WARNING",
                  code: "ORPHAN_FK_CATEGORY",
                  message: `Item ${rawItem.externalId} references missing category ${rawItem.categoryExternalId}; category FK will be set to NULL`,
                  externalId: rawItem.externalId,
                  field: "categoryExternalId",
                });
              }
            }

            let preferredSupplierInternalId: string | null = null;
            if (rawItem.preferredSupplierExternalId) {
              preferredSupplierInternalId = ctx.idMap.get(
                "SUPPLIER",
                rawItem.preferredSupplierExternalId,
              );
              if (!preferredSupplierInternalId) {
                // Orphan FK: supplier import failed or was skipped.
                errors.push({
                  severity: "WARNING",
                  code: "ORPHAN_FK_SUPPLIER",
                  message: `Item ${rawItem.externalId} references missing supplier ${rawItem.preferredSupplierExternalId}; supplier FK will be set to NULL`,
                  externalId: rawItem.externalId,
                  field: "preferredSupplierExternalId",
                });
              }
            }

            // Upsert via external ID (idempotent).
            const itemId = await upsertItemByExternal(
              { db: tx, organizationId: ctx.organizationId, source: ctx.snapshot.source },
              {
                externalId: rawItem.externalId,
                sku: rawItem.sku,
                name: rawItem.name,
                barcode: rawItem.barcode,
                description: rawItem.description,
                unit: rawItem.unit,
                costPrice: rawItem.costPrice,
                salePrice: rawItem.salePrice,
                currency: rawItem.currency,
                reorderPoint: rawItem.reorderPoint,
                reorderQty: rawItem.reorderQty,
                categoryInternalId,
                preferredSupplierInternalId,
              },
            );

            // Check if created or updated (simple heuristic).
            const existing = await tx.item.findUnique({
              where: { id: itemId },
              select: { createdAt: true, updatedAt: true },
            });

            if (existing && existing.createdAt === existing.updatedAt) {
              bCreated++;
              createdIds.push(itemId);
            } else {
              bUpdated++;
            }

            ctx.idMap.set("ITEM", rawItem.externalId, itemId);
          } catch (e) {
            errors.push({
              severity: "ERROR",
              code: "ITEM_IMPORT_FAILED",
              message: `Failed to import item ${rawItem.externalId}: ${e instanceof Error ? e.message : String(e)}`,
            });
          }
        }

        return { created: bCreated, updated: bUpdated };
      });

      created += result.created;
      updated += result.updated;
    } catch (e) {
      errors.push({
        severity: "ERROR",
        code: "ITEMS_BATCH_FAILED",
        message: `Batch failed: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }

  return { created, updated, failed: errors.length, createdIds, errors };
}
