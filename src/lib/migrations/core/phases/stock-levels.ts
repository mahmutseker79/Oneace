/**
 * Phase MIG-S2 — STOCK_LEVELS import phase.
 *
 * Imports stock levels with (itemId, warehouseId) upsert key.
 * Preserves warehouseLocation if provided; warns on negative quantities.
 */

import type { PhaseContext } from "@/lib/migrations/core/importer";

import type { ValidationIssue } from "@/lib/migrations/core/types";
export async function importStockLevels(ctx: PhaseContext): Promise<{
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
  for (let i = 0; i < ctx.snapshot.stockLevels.length; i += batchSize) {
    const batch = ctx.snapshot.stockLevels.slice(i, i + batchSize);

    try {
      const result = await ctx.db.$transaction(async (tx) => {
        let bCreated = 0;
        let bUpdated = 0;

        for (const rawLevel of batch) {
          try {
            // Check for orphan item (Phase S6).
            const itemId = ctx.idMap.get("ITEM", rawLevel.itemExternalId);
            if (!itemId) {
              errors.push({
                severity: "WARNING",
                code: "ORPHAN_STOCK_LEVEL",
                message: `Stock level for missing item ${rawLevel.itemExternalId} in warehouse ${rawLevel.warehouseExternalId} will be skipped`,
                field: "itemExternalId",
              });
              continue;
            }

            const warehouseId = ctx.idMap.require("WAREHOUSE", rawLevel.warehouseExternalId);

            // Resolve location if provided.
            const locationId = rawLevel.locationExternalId
              ? ctx.idMap.get("LOCATION", rawLevel.locationExternalId)
              : null;

            // Warn on negative quantities.
            if (rawLevel.quantity < 0) {
              errors.push({
                severity: "WARNING",
                code: "STOCK_LEVEL_NEGATIVE",
                message: `Stock level for item ${rawLevel.itemExternalId} in warehouse ${rawLevel.warehouseExternalId} is negative: ${rawLevel.quantity}`,
              });
            }

            // Upsert by (itemId, warehouseId).
            const existing = await tx.stockLevel.findFirst({
              where: { itemId, warehouseId },
              select: { id: true },
            });

            if (existing) {
              await tx.stockLevel.update({
                where: { id: existing.id },
                data: {
                  quantity: rawLevel.quantity,
                  warehouseLocationId: locationId ?? undefined,
                },
              });
              bUpdated++;
            } else {
              const created = await tx.stockLevel.create({
                data: {
                  itemId,
                  warehouseId,
                  quantity: rawLevel.quantity,
                  warehouseLocationId: locationId,
                },
                select: { id: true },
              });
              createdIds.push(created.id);
              bCreated++;
            }
          } catch (e) {
            errors.push({
              severity: "ERROR",
              code: "STOCK_LEVEL_FAILED",
              message: `Failed to import stock level: ${e instanceof Error ? e.message : String(e)}`,
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
        code: "STOCK_LEVELS_BATCH_FAILED",
        message: `Batch failed: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }

  return { created, updated, failed: errors.length, createdIds, errors };
}
