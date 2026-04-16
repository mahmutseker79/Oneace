import { type CsvColumn, csvResponse, serializeCsv, todayIsoDate } from "@/lib/csv";
import { db } from "@/lib/db";
import { hasPlanCapability } from "@/lib/plans";
import { RATE_LIMITS, rateLimit } from "@/lib/rate-limit";
import { requireActiveMembership } from "@/lib/session";

/**
 * GET /reports/stock-value/export — CSV per-warehouse inventory value.
 *
 * One row per (item × warehouse) where on-hand > 0. Items without a
 * cost price emit an empty "Value at cost" cell rather than zero so
 * the downstream sheet can flag them explicitly. Mirrors the on-screen
 * report at `/reports/stock-value`.
 */

type ExportRow = {
  warehouseName: string;
  warehouseCode: string;
  sku: string;
  name: string;
  unit: string;
  onHand: number;
  costPrice: string | null;
  currency: string;
  valueAtCost: string | null;
};

const columns: CsvColumn<ExportRow>[] = [
  { header: "Warehouse", value: (r) => r.warehouseName },
  { header: "Warehouse code", value: (r) => r.warehouseCode },
  { header: "SKU", value: (r) => r.sku },
  { header: "Name", value: (r) => r.name },
  { header: "Unit", value: (r) => r.unit },
  { header: "On hand", value: (r) => r.onHand },
  { header: "Cost price", value: (r) => r.costPrice },
  { header: "Currency", value: (r) => r.currency },
  { header: "Value at cost", value: (r) => r.valueAtCost },
];

export async function GET() {
  const { membership } = await requireActiveMembership();

  // Rate limit export endpoint: 10 per hour per user
  const rl = await rateLimit(`export:${membership.userId}`, RATE_LIMITS.export);
  if (!rl.ok) {
    return new Response(JSON.stringify({ error: "Export rate limit exceeded. Try again later." }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
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

  const items = await db.item.findMany({
    where: { organizationId: membership.organizationId, status: "ACTIVE" },
    select: {
      sku: true,
      name: true,
      unit: true,
      currency: true,
      costPrice: true,
      stockLevels: {
        where: { quantity: { gt: 0 } },
        select: {
          quantity: true,
          warehouse: { select: { name: true, code: true } },
        },
      },
    },
  });

  const rows: ExportRow[] = [];
  for (const item of items) {
    const costNum = item.costPrice ? Number(item.costPrice.toString()) : null;
    for (const level of item.stockLevels) {
      const valueAtCost = costNum == null ? null : costNum * level.quantity;
      rows.push({
        warehouseName: level.warehouse.name,
        warehouseCode: level.warehouse.code,
        sku: item.sku,
        name: item.name,
        unit: item.unit,
        onHand: level.quantity,
        costPrice: costNum == null ? null : costNum.toFixed(2),
        currency: item.currency,
        valueAtCost: valueAtCost == null ? null : valueAtCost.toFixed(2),
      });
    }
  }

  rows.sort((a, b) => {
    const w = a.warehouseName.localeCompare(b.warehouseName);
    return w !== 0 ? w : a.name.localeCompare(b.name);
  });

  const csv = serializeCsv(rows, columns);
  return csvResponse(`oneace-stock-value-${todayIsoDate()}.csv`, csv);
}
