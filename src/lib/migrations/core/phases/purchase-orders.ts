/**
 * Phase MIG-S2 — PURCHASE_ORDERS import phase.
 *
 * Imports POs and lines, honoring scope.poHistory cutoff.
 * If poHistory=SKIP, this phase returns early with 0 rows (caller short-circuits).
 * If poHistory=OPEN_ONLY, filters out closed/cancelled POs.
 * If poHistory=LAST_12_MONTHS, filters by orderDate.
 */

import type { PhaseContext } from "@/lib/migrations/core/importer";

import type { ValidationIssue } from "@/lib/migrations/core/types";
export async function importPurchaseOrders(ctx: PhaseContext): Promise<{
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

  // Filter POs by scope.
  let filteredPOs = ctx.snapshot.purchaseOrders;

  if (ctx.scope.poHistory === "OPEN_ONLY") {
    filteredPOs = filteredPOs.filter(
      (po) =>
        po.status && !["RECEIVED", "CLOSED", "CANCELLED"].includes(String(po.status).toUpperCase()),
    );
  } else if (ctx.scope.poHistory === "LAST_12_MONTHS" && ctx.scope.dateRangeStart) {
    const cutoff = new Date(ctx.scope.dateRangeStart);
    filteredPOs = filteredPOs.filter((po) => po.orderDate && new Date(po.orderDate) >= cutoff);
  }

  const batchSize = 100;
  for (let i = 0; i < filteredPOs.length; i += batchSize) {
    const batch = filteredPOs.slice(i, i + batchSize);

    try {
      const result = await ctx.db.$transaction(async (tx) => {
        let bCreated = 0;
        let bUpdated = 0;

        for (const rawPO of batch) {
          try {
            const supplierId = ctx.idMap.require("SUPPLIER", rawPO.supplierExternalId);

            // Upsert PO by external ID.
            const existing = await tx.purchaseOrder.findFirst({
              where: {
                organizationId: ctx.organizationId,
                externalSource: ctx.snapshot.source,
                externalId: rawPO.externalId,
              },
              select: { id: true },
            });

            let poId: string;
            if (existing) {
              await tx.purchaseOrder.update({
                where: { id: existing.id },
                data: {
                  poNumber: rawPO.poNumber,
                  supplierId,
                  status: (rawPO.status as any) ?? undefined,
                  orderDate: rawPO.orderDate ? new Date(rawPO.orderDate) : undefined,
                  expectedDate: rawPO.expectedDate ? new Date(rawPO.expectedDate) : undefined,
                  notes: rawPO.notes ?? undefined,
                },
              });
              poId = existing.id;
              bUpdated++;
            } else {
              const created = await tx.purchaseOrder.create({
                data: {
                  organizationId: ctx.organizationId,
                  createdByUserId: ctx.migrationJobId, // Placeholder; normally a real user.
                  externalSource: ctx.snapshot.source,
                  externalId: rawPO.externalId,
                  poNumber: rawPO.poNumber,
                  supplierId,
                  status: (rawPO.status as any) ?? "PENDING",
                  orderDate: rawPO.orderDate ? new Date(rawPO.orderDate) : null,
                  expectedDate: rawPO.expectedDate ? new Date(rawPO.expectedDate) : null,
                  notes: rawPO.notes,
                },
                select: { id: true },
              });
              poId = created.id;
              createdIds.push(created.id);
              bCreated++;
            }

            // Import PO lines (Phase S6: skip orphan items).
            for (const line of rawPO.lines) {
              try {
                const itemId = ctx.idMap.get("ITEM", line.itemExternalId);
                if (!itemId) {
                  errors.push({
                    severity: "WARNING",
                    code: "ORPHAN_PO_LINE",
                    message: `PO line for missing item ${line.itemExternalId} in PO ${rawPO.externalId} will be skipped`,
                    field: "itemExternalId",
                  });
                  continue;
                }

                const lineExisting = await tx.purchaseOrderLine.findFirst({
                  where: {
                    purchaseOrderId: poId,
                    itemId,
                  },
                  select: { id: true },
                });

                if (lineExisting) {
                  await tx.purchaseOrderLine.update({
                    where: { id: lineExisting.id },
                    data: {
                      quantity: line.quantity,
                      unitCost: line.unitCost ?? undefined,
                    },
                  });
                } else {
                  await tx.purchaseOrderLine.create({
                    data: {
                      purchaseOrderId: poId,
                      itemId,
                      quantity: line.quantity,
                      unitCost: line.unitCost,
                      totalPrice: line.unitCost ? line.unitCost * line.quantity : 0,
                    },
                  });
                }
              } catch (e) {
                errors.push({
                  severity: "WARNING",
                  code: "PO_LINE_FAILED",
                  message: `Failed to import PO line: ${e instanceof Error ? e.message : String(e)}`,
                });
              }
            }
          } catch (e) {
            errors.push({
              severity: "ERROR",
              code: "PURCHASE_ORDER_FAILED",
              message: `Failed to import PO ${rawPO.externalId}: ${e instanceof Error ? e.message : String(e)}`,
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
        code: "PURCHASE_ORDERS_BATCH_FAILED",
        message: `Batch failed: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }

  return { created, updated, failed: errors.length, createdIds, errors };
}
