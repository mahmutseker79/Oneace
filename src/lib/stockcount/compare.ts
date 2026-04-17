/**
 * Phase B: Count Comparison — side-by-side analysis of two counts.
 *
 * Used for reviewing differences between a new count and previous baseline.
 * Returns structured comparison rows ready for table display.
 */

import { db } from "@/lib/db";

export interface ComparisonRow {
  itemId: string;
  itemSku: string;
  itemName: string;
  warehouseCode: string;
  count1Qty: number;
  count2Qty: number;
  difference: number;
  variancePercent: number;
}

/**
 * Compare two stock counts side-by-side.
 *
 * Returns sorted rows showing items in both counts with quantity differences.
 */
export async function compareStockCounts(
  countId1: string,
  countId2: string,
  _orgId: string,
): Promise<ComparisonRow[]> {
  // Fetch entries for both counts
  const [entries1, entries2] = await Promise.all([
    db.countEntry.findMany({
      where: { countId: countId1 },
      select: {
        itemId: true,
        warehouseId: true,
        countedQuantity: true,
        item: { select: { sku: true, name: true } },
        warehouse: { select: { code: true } },
      },
    }),
    db.countEntry.findMany({
      where: { countId: countId2 },
      select: {
        itemId: true,
        warehouseId: true,
        countedQuantity: true,
        item: { select: { sku: true, name: true } },
        warehouse: { select: { code: true } },
      },
    }),
  ]);

  // Build maps for quick lookup
  const map1 = new Map<string, (typeof entries1)[0]>();
  const map2 = new Map<string, (typeof entries2)[0]>();

  for (const entry of entries1) {
    map1.set(`${entry.itemId}:${entry.warehouseId}`, entry);
  }
  for (const entry of entries2) {
    map2.set(`${entry.itemId}:${entry.warehouseId}`, entry);
  }

  // Combine keys from both maps
  const allKeys = new Set<string>([...map1.keys(), ...map2.keys()]);

  const rows: ComparisonRow[] = [];
  for (const key of allKeys) {
    const e1 = map1.get(key);
    const e2 = map2.get(key);

    // Include only if present in both counts
    if (!e1 || !e2) continue;

    const qty1 = e1.countedQuantity;
    const qty2 = e2.countedQuantity;
    const diff = qty2 - qty1;

    // Calculate variance percent (avoid division by zero)
    const variancePercent = qty1 === 0 ? (qty2 > 0 ? 100 : 0) : (diff / qty1) * 100;

    rows.push({
      itemId: e1.itemId,
      itemSku: e1.item.sku,
      itemName: e1.item.name,
      warehouseCode: e1.warehouse.code,
      count1Qty: qty1,
      count2Qty: qty2,
      difference: diff,
      variancePercent,
    });
  }

  // Sort by warehouse code, then item SKU
  rows.sort((a, b) => {
    if (a.warehouseCode !== b.warehouseCode) {
      return a.warehouseCode.localeCompare(b.warehouseCode);
    }
    return a.itemSku.localeCompare(b.itemSku);
  });

  return rows;
}
