"use server";

import { db } from "@/lib/db";
import { requireActiveMembership } from "@/lib/session";

export type ScanLookupResult =
  | {
      ok: true;
      found: true;
      item: {
        id: string;
        name: string;
        sku: string;
        barcode: string | null;
        status: string;
        unit: string;
        reorderPoint: number;
        reorderQty: number;
        totalOnHand: number;
        totalReserved: number;
        levels: Array<{
          warehouseId: string;
          warehouseName: string;
          warehouseCode: string;
          quantity: number;
          reserved: number;
        }>;
      };
    }
  | { ok: true; found: false; query: string }
  | { ok: false; error: string };

/**
 * Look up an item by barcode or SKU, scoped to the active organization.
 * Used by the /scan page after a successful camera scan *or* manual entry.
 */
export async function lookupItemByCodeAction(rawCode: string): Promise<ScanLookupResult> {
  const code = rawCode.trim();
  if (!code) {
    return { ok: false, error: "Empty code" };
  }

  const { membership } = await requireActiveMembership();

  const item = await db.item.findFirst({
    where: {
      organizationId: membership.organizationId,
      OR: [{ barcode: code }, { sku: code }],
    },
    include: {
      stockLevels: {
        include: {
          warehouse: { select: { id: true, name: true, code: true } },
        },
        orderBy: { warehouse: { name: "asc" } },
      },
    },
  });

  if (!item) {
    return { ok: true, found: false, query: code };
  }

  const totalOnHand = item.stockLevels.reduce((sum, lvl) => sum + lvl.quantity, 0);
  const totalReserved = item.stockLevels.reduce((sum, lvl) => sum + lvl.reservedQty, 0);

  return {
    ok: true,
    found: true,
    item: {
      id: item.id,
      name: item.name,
      sku: item.sku,
      barcode: item.barcode,
      status: item.status,
      unit: item.unit,
      reorderPoint: item.reorderPoint,
      reorderQty: item.reorderQty,
      totalOnHand,
      totalReserved,
      levels: item.stockLevels.map((lvl) => ({
        warehouseId: lvl.warehouseId,
        warehouseName: lvl.warehouse.name,
        warehouseCode: lvl.warehouse.code,
        quantity: lvl.quantity,
        reserved: lvl.reservedQty,
      })),
    },
  };
}
