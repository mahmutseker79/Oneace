/**
 * Phase MIG-S2 — CATEGORIES import phase.
 *
 * Imports categories with parent-child relationships.
 * Must be run first (only dependency is self-referencing parents).
 * Uses topological sort to ensure parents are created before children.
 */

import type { PrismaClient } from "@/generated/prisma";
import { IdMap, type IdMapKind } from "@/lib/migrations/core/id-map";
import type { PhaseContext } from "@/lib/migrations/core/importer";
import { type SortResult, sortCategoriesByParent } from "@/lib/migrations/core/topological-sort";
import type { ValidationIssue } from "@/lib/migrations/core/types";

export async function importCategories(ctx: PhaseContext): Promise<{
  created: number;
  updated: number;
  failed: number;
  createdIds: string[];
  errors: ValidationIssue[];
}> {
  const startedAt = new Date();
  let created = 0;
  let updated = 0;
  let failed = 0;
  const createdIds: string[] = [];
  const errors: ValidationIssue[] = [];

  // Sort categories topologically.
  const sortResult = sortCategoriesByParent(ctx.snapshot.categories);
  if (sortResult.issues.some((i) => i.severity === "ERROR")) {
    errors.push(...sortResult.issues.filter((i) => i.severity === "ERROR"));
    return { created, updated, failed: ctx.snapshot.categories.length, createdIds, errors };
  }

  const sortedCategories = sortResult.sorted;

  // Batch-write in groups of 100 inside a transaction.
  const batchSize = 100;
  for (let i = 0; i < sortedCategories.length; i += batchSize) {
    const batch = sortedCategories.slice(i, i + batchSize);

    try {
      const result = await ctx.db.$transaction(async (tx) => {
        let bCreated = 0;
        let bUpdated = 0;

        for (const rawCat of batch) {
          try {
            // Resolve parent ID via the idMap.
            const parentId = rawCat.parentExternalId
              ? ctx.idMap.get("CATEGORY", rawCat.parentExternalId)
              : null;

            // Check if this category already exists (idempotent upsert).
            const existing = await tx.category.findFirst({
              where: {
                organizationId: ctx.organizationId,
                externalSource: ctx.snapshot.source,
                externalId: rawCat.externalId,
              },
              select: { id: true },
            });

            if (existing) {
              // Update if changed.
              await tx.category.update({
                where: { id: existing.id },
                data: {
                  name: rawCat.name,
                  description: rawCat.description ?? undefined,
                  parentId: parentId ?? undefined,
                },
              });
              bUpdated++;
            } else {
              // Create new.
              const created = await tx.category.create({
                data: {
                  organizationId: ctx.organizationId,
                  externalSource: ctx.snapshot.source,
                  externalId: rawCat.externalId,
                  name: rawCat.name,
                  description: rawCat.description,
                  parentId,
                  code: null,
                },
                select: { id: true },
              });
              ctx.idMap.set("CATEGORY", rawCat.externalId, created.id);
              createdIds.push(created.id);
              bCreated++;
            }
          } catch (e) {
            failed++;
            errors.push({
              severity: "ERROR",
              code: "CATEGORY_IMPORT_FAILED",
              message: `Failed to import category ${rawCat.externalId}: ${e instanceof Error ? e.message : String(e)}`,
              context: { externalId: rawCat.externalId },
            });
          }
        }

        return { created: bCreated, updated: bUpdated };
      });

      created += result.created;
      updated += result.updated;
    } catch (e) {
      failed += batch.length;
      errors.push({
        severity: "ERROR",
        code: "CATEGORIES_BATCH_FAILED",
        message: `Batch ${Math.floor(i / batchSize)} failed: ${e instanceof Error ? e.message : String(e)}`,
        context: { batchStart: i, batchSize: batch.length },
      });
    }
  }

  return { created, updated, failed, createdIds, errors };
}
