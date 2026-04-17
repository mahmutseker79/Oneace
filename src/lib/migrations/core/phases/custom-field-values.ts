/**
 * Phase MIG-S2 — CUSTOM_FIELD_VALUES import phase.
 *
 * Writes ItemCustomFieldValue rows, routing values to the correct
 * type-specific column (valueText, valueNumber, valueDate, etc.).
 */

import type { PhaseContext } from "@/lib/migrations/core/importer";

import type { ValidationIssue } from "@/lib/migrations/core/types";
export async function importCustomFieldValues(ctx: PhaseContext): Promise<{
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

  // Flatten: each item's custom field values become separate rows.
  const allValues: Array<{
    itemExternalId: string;
    fieldKey: string;
    fieldExternalId: string;
    valueText?: string | null;
    valueNumber?: number | null;
    valueDate?: string | null;
    valueBoolean?: boolean | null;
    valueJson?: unknown;
  }> = [];

  for (const item of ctx.snapshot.items) {
    if (!item.customFieldValues) continue;

    for (const [fieldKey, rawVal] of Object.entries(item.customFieldValues)) {
      // Infer external ID from field key (simple strategy; adapters may override).
      const fieldExternalId = fieldKey;

      allValues.push({
        itemExternalId: item.externalId,
        fieldKey,
        fieldExternalId,
        valueText: rawVal.valueText,
        valueNumber: rawVal.valueNumber,
        valueDate: rawVal.valueDate,
        valueBoolean: rawVal.valueBoolean,
        valueJson: rawVal.valueJson,
      });
    }
  }

  const batchSize = 100;
  for (let i = 0; i < allValues.length; i += batchSize) {
    const batch = allValues.slice(i, i + batchSize);

    try {
      const result = await ctx.db.$transaction(async (tx) => {
        let bCreated = 0;
        let bUpdated = 0;

        for (const val of batch) {
          try {
            const itemId = ctx.idMap.require("ITEM", val.itemExternalId);
            const fieldDefId = ctx.idMap.require(
              "CUSTOM_FIELD_DEF",
              val.fieldExternalId,
            );

            // Upsert by (itemId, fieldDefId).
            const existing = await tx.itemCustomFieldValue.findFirst({
              where: { itemId, customFieldDefinitionId: fieldDefId },
              select: { id: true },
            });

            if (existing) {
              await tx.itemCustomFieldValue.update({
                where: { id: existing.id },
                data: {
                  valueText: val.valueText ?? null,
                  valueNumber: val.valueNumber ?? null,
                  valueDate: val.valueDate ?? null,
                  valueBoolean: val.valueBoolean ?? null,
                  valueJson: val.valueJson ?? null,
                },
              });
              bUpdated++;
            } else {
              const created = await tx.itemCustomFieldValue.create({
                data: {
                  itemId,
                  customFieldDefinitionId: fieldDefId,
                  valueText: val.valueText,
                  valueNumber: val.valueNumber,
                  valueDate: val.valueDate,
                  valueBoolean: val.valueBoolean,
                  valueJson: val.valueJson,
                },
                select: { id: true },
              });
              createdIds.push(created.id);
              bCreated++;
            }
          } catch (e) {
            errors.push({
              severity: "ERROR",
              code: "CUSTOM_FIELD_VALUE_FAILED",
              message: `Failed to import custom field value: ${e instanceof Error ? e.message : String(e)}`,
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
        code: "CUSTOM_FIELD_VALUES_BATCH_FAILED",
        message: `Batch failed: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }

  return { created, updated, failed: errors.length, createdIds, errors };
}
