/**
 * Phase MIG-S2 — SUPPLIERS import phase.
 */

import type { PhaseContext } from "@/lib/migrations/core/importer";

import type { ValidationIssue } from "@/lib/migrations/core/types";
export async function importSuppliers(ctx: PhaseContext): Promise<{
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
  for (let i = 0; i < ctx.snapshot.suppliers.length; i += batchSize) {
    const batch = ctx.snapshot.suppliers.slice(i, i + batchSize);

    try {
      const result = await ctx.db.$transaction(async (tx) => {
        let bCreated = 0;
        let bUpdated = 0;

        for (const rawSupplier of batch) {
          try {
            const existing = await tx.supplier.findFirst({
              where: {
                organizationId: ctx.organizationId,
                externalSource: ctx.snapshot.source,
                externalId: rawSupplier.externalId,
              },
              select: { id: true },
            });

            if (existing) {
              await tx.supplier.update({
                where: { id: existing.id },
                data: {
                  name: rawSupplier.name,
                  contactName: rawSupplier.contactName ?? undefined,
                  email: rawSupplier.email ?? undefined,
                  phone: rawSupplier.phone ?? undefined,
                  website: rawSupplier.website ?? undefined,
                  address: rawSupplier.address ?? undefined,
                  notes: rawSupplier.notes ?? undefined,
                },
              });
              bUpdated++;
            } else {
              const created = await tx.supplier.create({
                data: {
                  organizationId: ctx.organizationId,
                  externalSource: ctx.snapshot.source,
                  externalId: rawSupplier.externalId,
                  name: rawSupplier.name,
                  contactName: rawSupplier.contactName,
                  email: rawSupplier.email,
                  phone: rawSupplier.phone,
                  website: rawSupplier.website,
                  address: rawSupplier.address,
                  notes: rawSupplier.notes,
                },
                select: { id: true },
              });
              ctx.idMap.set("SUPPLIER", rawSupplier.externalId, created.id);
              createdIds.push(created.id);
              bCreated++;
            }
          } catch (e) {
            errors.push({
              severity: "ERROR",
              code: "SUPPLIER_IMPORT_FAILED",
              message: `Failed to import supplier ${rawSupplier.externalId}: ${e instanceof Error ? e.message : String(e)}`,
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
        code: "SUPPLIERS_BATCH_FAILED",
        message: `Batch failed: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }

  return { created, updated, failed: errors.length, createdIds, errors };
}
