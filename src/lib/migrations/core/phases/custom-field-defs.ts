/**
 * Phase MIG-S2 — CUSTOM_FIELD_DEFS import phase.
 */

import { upsertCustomFieldDefinitionByExternal } from "@/lib/migrations/core/id-map";
import type { PhaseContext } from "@/lib/migrations/core/importer";

import type { ValidationIssue } from "@/lib/migrations/core/types";
export async function importCustomFieldDefs(ctx: PhaseContext): Promise<{
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
  for (let i = 0; i < ctx.snapshot.customFieldDefs.length; i += batchSize) {
    const batch = ctx.snapshot.customFieldDefs.slice(i, i + batchSize);

    try {
      const result = await ctx.db.$transaction(async (tx) => {
        let bCreated = 0;
        let bUpdated = 0;

        for (const rawDef of batch) {
          try {
            const id = await upsertCustomFieldDefinitionByExternal(
              { db: tx, organizationId: ctx.organizationId, source: ctx.snapshot.source },
              {
                externalId: rawDef.externalId,
                entityType: "ITEM",
                name: rawDef.name,
                fieldKey: rawDef.fieldKey,
                fieldType: rawDef.fieldType,
                options: rawDef.options,
                isRequired: rawDef.isRequired,
                defaultValue: rawDef.defaultValue,
                sortOrder: rawDef.sortOrder,
              },
            );

            // Determine if created or updated by checking the timestamp.
            const existing = await tx.customFieldDefinition.findUnique({
              where: { id },
              select: { createdAt: true, updatedAt: true },
            });

            if (existing && existing.createdAt === existing.updatedAt) {
              bCreated++;
              createdIds.push(id);
            } else {
              bUpdated++;
            }

            ctx.idMap.set("CUSTOM_FIELD_DEF", rawDef.externalId, id);
          } catch (e) {
            errors.push({
              severity: "ERROR",
              code: "CUSTOM_FIELD_DEF_FAILED",
              message: `Failed to import custom field def ${rawDef.externalId}: ${e instanceof Error ? e.message : String(e)}`,
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
        code: "CUSTOM_FIELD_DEFS_BATCH_FAILED",
        message: `Batch failed: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }

  return { created, updated, failed: errors.length, createdIds, errors };
}
