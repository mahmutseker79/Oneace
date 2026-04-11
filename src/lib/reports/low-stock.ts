// Sprint 41: shared low-stock query used by three surfaces.
//
// Before this sprint the "which items are at or below reorder point?"
// question was answered inline by three different call sites:
//
//   * `/reports/low-stock/page.tsx` — the on-screen report
//   * `/reports/low-stock/export/route.ts` — the CSV download
//   * (new in Sprint 41) the daily/weekly notification digest
//
// Two near-identical copies was already an unstable footing: the page
// and the CSV drifted in how they sorted "no supplier" groups, and
// any future rule change (e.g. "exclude DRAFT items", "treat 0
// reorderPoint as infinity") would have to be applied in two places.
// Adding a third copy for the digest is where we draw the line.
//
// The helper is a pure DB query + in-memory shape. It does NOT paginate,
// because the entire point of the digest is "show me the full current
// shortfall list" — an org with thousands of low-stock items is a much
// bigger alarm than a missing pagination, and the page/CSV already
// render the same full list without trouble. If we ever hit real scale
// ceilings here we'll push the filter into SQL.
//
// Why no Prisma type imports: keeping this file free of
// `import type { Prisma } from "@/generated/prisma"` means it can be
// consumed from scripts and route handlers without pulling in the
// generator's barrel. The input is an organization id + the shared
// `db` client, and the output is a small POJO shape the page, CSV, and
// email template all render from.

import { db } from "@/lib/db";

/**
 * A single item that is at or below its reorder point.
 *
 * `onHand` is the sum of `StockLevel.quantity` across every warehouse,
 * matching what the page has shown since Sprint 1 — per-warehouse
 * breakdown is a different report and deliberately out of scope here.
 *
 * `preferredSupplier` is nullable because the item may not have one
 * assigned; the digest and the report both handle that case in their
 * grouping step.
 */
export type LowStockItem = {
  id: string;
  sku: string;
  name: string;
  onHand: number;
  reorderPoint: number;
  reorderQty: number;
  preferredSupplier: { id: string; name: string } | null;
};

/**
 * A group of low-stock items sharing the same preferred supplier. A
 * `null` supplier means "items with no preferred supplier set" — always
 * rendered last so reviewers don't have to scan past it for the
 * actionable rows.
 */
export type LowStockGroup = {
  supplier: { id: string; name: string } | null;
  items: LowStockItem[];
};

/**
 * Query every ACTIVE item in an org, keep only those where
 *   reorderPoint > 0 AND onHand <= reorderPoint
 * and return them sorted by shortfall descending (most urgent first).
 *
 * `reorderPoint > 0` is the implicit "opted into reorder tracking"
 * signal — items with a zero reorder point never alert even at zero
 * on-hand, which matches the legacy Flutter behaviour and keeps
 * brand-new imported catalogues quiet until a human sets thresholds.
 */
export async function getLowStockItems(organizationId: string): Promise<LowStockItem[]> {
  const items = await db.item.findMany({
    where: { organizationId, status: "ACTIVE" },
    select: {
      id: true,
      sku: true,
      name: true,
      reorderPoint: true,
      reorderQty: true,
      preferredSupplier: { select: { id: true, name: true } },
      stockLevels: { select: { quantity: true } },
    },
  });

  return items
    .map((item) => {
      const onHand = item.stockLevels.reduce((acc, l) => acc + l.quantity, 0);
      return {
        id: item.id,
        sku: item.sku,
        name: item.name,
        onHand,
        reorderPoint: item.reorderPoint,
        reorderQty: item.reorderQty,
        preferredSupplier: item.preferredSupplier,
      };
    })
    .filter((item) => item.reorderPoint > 0 && item.onHand <= item.reorderPoint)
    .sort((a, b) => {
      const shortA = a.reorderPoint - a.onHand;
      const shortB = b.reorderPoint - b.onHand;
      return shortB - shortA;
    });
}

// Sentinel used to key the "no supplier" bucket during grouping. Kept
// as a private constant so a rogue supplier id can't accidentally
// collide (a cuid will never look like this string).
const NO_SUPPLIER = "__no_supplier__";

/**
 * Bucket a flat low-stock list by preferred supplier. Groups with a
 * supplier come first in alphabetical order; the unassigned bucket is
 * always last.
 *
 * Used by the on-screen report (one card per group, each with a
 * "Create PO for this supplier" shortcut) and by the email digest
 * (one `<h3>` per group so a warehouse manager's inbox preview shows
 * "Acme — 4 items · Beta Supply — 2 items" rather than a flat wall).
 */
export function groupBySupplier(items: LowStockItem[]): LowStockGroup[] {
  const bySupplier = new Map<string, LowStockGroup>();

  for (const item of items) {
    const key = item.preferredSupplier?.id ?? NO_SUPPLIER;
    let group = bySupplier.get(key);
    if (!group) {
      group = { supplier: item.preferredSupplier, items: [] };
      bySupplier.set(key, group);
    }
    group.items.push(item);
  }

  return Array.from(bySupplier.values()).sort((a, b) => {
    if (!a.supplier && !b.supplier) return 0;
    if (!a.supplier) return 1;
    if (!b.supplier) return -1;
    return a.supplier.name.localeCompare(b.supplier.name);
  });
}
