/**
 * Phase MIG-S2 — WAREHOUSES import phase.
 */

import type { PhaseContext } from "@/lib/migrations/core/importer";

import type { ValidationIssue } from "@/lib/migrations/core/types";
export async function importWarehouses(ctx: PhaseContext): Promise<{
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
  for (let i = 0; i < ctx.snapshot.warehouses.length; i += batchSize) {
    const batch = ctx.snapshot.warehouses.slice(i, i + batchSize);

    try {
      const result = await ctx.db.$transaction(async (tx) => {
        let bCreated = 0;
        let bUpdated = 0;

        for (const rawWh of batch) {
          try {
            const existing = await tx.warehouse.findFirst({
              where: {
                organizationId: ctx.organizationId,
                externalSource: ctx.snapshot.source,
                externalId: rawWh.externalId,
              },
              select: { id: true },
            });

            if (existing) {
              await tx.warehouse.update({
                where: { id: existing.id },
                data: {
                  name: rawWh.name,
                  code: rawWh.code ?? undefined,
                  address: rawWh.address ?? undefined,
                },
              });
              bUpdated++;
            } else {
              const created = await tx.warehouse.create({
                data: {
                  organizationId: ctx.organizationId,
                  externalSource: ctx.snapshot.source,
                  externalId: rawWh.externalId,
                  name: rawWh.name,
                  code: rawWh.code,
                  address: rawWh.address,
                  isDefault: rawWh.isDefault ?? false,
                },
                select: { id: true },
              });
              ctx.idMap.set("WAREHOUSE", rawWh.externalId, created.id);
              createdIds.push(created.id);
              bCreated++;
            }
          } catch (e) {
            errors.push({
              severity: "ERROR",
              code: "WAREHOUSE_IMPORT_FAILED",
              message: `Failed to import warehouse ${rawWh.externalId}: ${e instanceof Error ? e.message : String(e)}`,
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
        code: "WAREHOUSES_BATCH_FAILED",
        message: `Batch failed: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }

  return { created, updated, failed: errors.length, createdIds, errors };
}
