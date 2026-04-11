import { type CsvColumn, csvResponse, serializeCsv, todayIsoDate } from "@/lib/csv";
// Sprint 41: query moved to `src/lib/reports/low-stock.ts` so the CSV and
// the on-screen report can't drift. The CSV is intentionally flat (no
// grouping) — the helper's flat result is exactly what we want here.
import { getLowStockItems } from "@/lib/reports/low-stock";
import { requireActiveMembership } from "@/lib/session";

/**
 * GET /reports/low-stock/export — CSV of every ACTIVE item whose on-hand
 * is at or below its reorder point. Sorted by shortfall desc so the
 * most urgent lines are at the top, matching the page's order.
 */

type ExportRow = {
  sku: string;
  name: string;
  supplierName: string | null;
  onHand: number;
  reorderPoint: number;
  shortfall: number;
  reorderQty: number;
};

const columns: CsvColumn<ExportRow>[] = [
  { header: "SKU", value: (r) => r.sku },
  { header: "Name", value: (r) => r.name },
  { header: "Preferred supplier", value: (r) => r.supplierName },
  { header: "On hand", value: (r) => r.onHand },
  { header: "Reorder point", value: (r) => r.reorderPoint },
  { header: "Shortfall", value: (r) => r.shortfall },
  { header: "Reorder qty", value: (r) => r.reorderQty },
];

export async function GET() {
  const { membership } = await requireActiveMembership();

  const items = await getLowStockItems(membership.organizationId);
  const rows: ExportRow[] = items.map((item) => ({
    sku: item.sku,
    name: item.name,
    supplierName: item.preferredSupplier?.name ?? null,
    onHand: item.onHand,
    reorderPoint: item.reorderPoint,
    shortfall: item.reorderPoint - item.onHand,
    reorderQty: item.reorderQty,
  }));

  const csv = serializeCsv(rows, columns);
  return csvResponse(`oneace-low-stock-${todayIsoDate()}.csv`, csv);
}
