/**
 * Phase MIG-S2 — LOCATIONS import phase.
 */

import type { PhaseContext } from "@/lib/migrations/core/importer";

import type { ValidationIssue } from "@/lib/migrations/core/types";
export async function importLocations(ctx: PhaseContext): Promise<{
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
  for (let i = 0; i < ctx.snapshot.locations.length; i += batchSize) {
    const batch = ctx.snapshot.locations.slice(i, i + batchSize);

    try {
      const result = await ctx.db.$transaction(async (tx) => {
        let bCreated = 0;
        let bUpdated = 0;

        for (const rawLoc of batch) {
          try {
            const warehouseId = ctx.idMap.require(
              "WAREHOUSE",
              rawLoc.warehouseExternalId,
            );
            const parentLocationId = rawLoc.parentLocationExternalId
              ? ctx.idMap.get("LOCATION", rawLoc.parentLocationExternalId)
              : null;

            const existing = await tx.location.findFirst({
              where: {
                organizationId: ctx.organizationId,
                externalSource: ctx.snapshot.source,
                externalId: rawLoc.externalId,
              },
              select: { id: true },
            });

            if (existing) {
              await tx.location.update({
                where: { id: existing.id },
                data: {
                  name: rawLoc.name,
                  code: rawLoc.code ?? undefined,
                  parentLocationId: parentLocationId ?? undefined,
                },
              });
              bUpdated++;
            } else {
              const created = await tx.location.create({
                data: {
                  organizationId: ctx.organizationId,
                  warehouseId,
                  externalSource: ctx.snapshot.source,
                  externalId: rawLoc.externalId,
                  name: rawLoc.name,
                  code: rawLoc.code,
                  parentLocationId,
                },
                select: { id: true },
              });
              ctx.idMap.set("LOCATION", rawLoc.externalId, created.id);
              createdIds.push(created.id);
              bCreated++;
            }
          } catch (e) {
            errors.push({
              severity: "ERROR",
              code: "LOCATION_IMPORT_FAILED",
              message: `Failed to import location ${rawLoc.externalId}: ${e instanceof Error ? e.message : String(e)}`,
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
        code: "LOCATIONS_BATCH_FAILED",
        message: `Batch failed: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }

  return { created, updated, failed: errors.length, createdIds, errors };
}
