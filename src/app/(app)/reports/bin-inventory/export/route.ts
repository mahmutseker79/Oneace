import { type CsvColumn, csvResponse, serializeCsv, todayIsoDate } from "@/lib/csv";
import { db } from "@/lib/db";
import { hasPlanCapability } from "@/lib/plans";
import { requireActiveMembership } from "@/lib/session";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

/**
 * GET /reports/bin-inventory/export — CSV of all bin-level stock levels.
 *
 * Returns one row per (warehouse, bin, item) combination where binId IS NOT
 * NULL and quantity > 0. Sorted warehouse → bin code → item name so the CSV
 * mirrors the on-screen grouping when sorted in a spreadsheet.
 */

type ExportRow = {
  warehouse: string;
  warehouseCode: string;
  binCode: string;
  binLabel: string | null;
  sku: string;
  name: string;
  unit: string;
  quantity: number;
};

const columns: CsvColumn<ExportRow>[] = [
  { header: "Warehouse", value: (r) => r.warehouse },
  { header: "Warehouse code", value: (r) => r.warehouseCode },
  { header: "Bin code", value: (r) => r.binCode },
  { header: "Bin label", value: (r) => r.binLabel },
  { header: "SKU", value: (r) => r.sku },
  { header: "Item name", value: (r) => r.name },
  { header: "Unit", value: (r) => r.unit },
  { header: "Quantity", value: (r) => r.quantity },
];

export async function GET() {
  const { membership } = await requireActiveMembership();

  // Rate limit export endpoint: 10 per hour per user
  const rl = await rateLimit(`export:${membership.userId}`, RATE_LIMITS.export);
  if (!rl.ok) {
    return new Response(
      JSON.stringify({ error: "Export rate limit exceeded. Try again later." }),
      { status: 429, headers: { "Content-Type": "application/json" } },
    );
  }

  // Phase 13.2 — exports require PRO or BUSINESS plan
  const exportPlan = membership.organization.plan as "FREE" | "PRO" | "BUSINESS";
  if (!hasPlanCapability(exportPlan, "exports")) {
    return new Response(
      JSON.stringify({
        error:
          "Exports are available on Pro and Business plans. Upgrade to unlock CSV and Excel exports.",
      }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }

  const levels = await db.stockLevel.findMany({
    where: {
      organizationId: membership.organizationId,
      binId: { not: null },
      quantity: { gt: 0 },
    },
    select: {
      quantity: true,
      bin: { select: { code: true, label: true } },
      item: { select: { sku: true, name: true, unit: true } },
      warehouse: { select: { name: true, code: true } },
    },
    orderBy: [{ warehouse: { name: "asc" } }, { bin: { code: "asc" } }, { item: { name: "asc" } }],
  });

  const rows: ExportRow[] = levels
    .filter((l) => l.bin && l.item && l.warehouse)
    .map((l) => ({
      warehouse: l.warehouse!.name,
      warehouseCode: l.warehouse!.code,
      binCode: l.bin!.code,
      binLabel: l.bin!.label ?? null,
      sku: l.item!.sku,
      name: l.item!.name,
      unit: l.item!.unit,
      quantity: l.quantity,
    }));

  const csv = serializeCsv(rows, columns);
  return csvResponse(`oneace-bin-inventory-${todayIsoDate()}.csv`, csv);
}
