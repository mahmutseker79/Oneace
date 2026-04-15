import { type CsvColumn, csvResponse, serializeCsv, todayIsoDate } from "@/lib/csv";
import { db } from "@/lib/db";
import { hasPlanCapability } from "@/lib/plans";
import { requireActiveMembership } from "@/lib/session";

/**
 * GET /items/export — streams a CSV snapshot of the active org's items.
 *
 * The export mirrors what the `/items` list page shows but flattens a
 * few relations: category name, preferred supplier name, and the
 * aggregate on-hand / reserved totals across all warehouses. We
 * deliberately do NOT include per-warehouse breakdowns here — that
 * would require a wide/tall choice with no obviously correct answer.
 * Per-warehouse data lives on the item detail page and in the stock-
 * value report.
 */

type ExportRow = {
  sku: string;
  name: string;
  barcode: string | null;
  categoryName: string | null;
  supplierName: string | null;
  unit: string;
  costPrice: string | null;
  salePrice: string | null;
  currency: string;
  onHand: number;
  reserved: number;
  reorderPoint: number;
  reorderQty: number;
  status: string;
};

const columns: CsvColumn<ExportRow>[] = [
  { header: "SKU", value: (r) => r.sku },
  { header: "Name", value: (r) => r.name },
  { header: "Barcode", value: (r) => r.barcode },
  { header: "Category", value: (r) => r.categoryName },
  { header: "Preferred supplier", value: (r) => r.supplierName },
  { header: "Unit", value: (r) => r.unit },
  { header: "Cost price", value: (r) => r.costPrice },
  { header: "Sale price", value: (r) => r.salePrice },
  { header: "Currency", value: (r) => r.currency },
  { header: "On hand", value: (r) => r.onHand },
  { header: "Reserved", value: (r) => r.reserved },
  { header: "Reorder point", value: (r) => r.reorderPoint },
  { header: "Reorder qty", value: (r) => r.reorderQty },
  { header: "Status", value: (r) => r.status },
];

export async function GET() {
  const { membership } = await requireActiveMembership();

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
    where: { organizationId: membership.organizationId },
    include: {
      category: { select: { name: true } },
      preferredSupplier: { select: { name: true } },
      stockLevels: { select: { quantity: true, reservedQty: true } },
    },
    orderBy: [{ name: "asc" }],
  });

  const rows: ExportRow[] = items.map((item) => {
    const onHand = item.stockLevels.reduce((acc, l) => acc + l.quantity, 0);
    const reserved = item.stockLevels.reduce((acc, l) => acc + l.reservedQty, 0);
    return {
      sku: item.sku,
      name: item.name,
      barcode: item.barcode,
      categoryName: item.category?.name ?? null,
      supplierName: item.preferredSupplier?.name ?? null,
      unit: item.unit,
      costPrice: item.costPrice?.toString() ?? null,
      salePrice: item.salePrice?.toString() ?? null,
      currency: item.currency,
      onHand,
      reserved,
      reorderPoint: item.reorderPoint,
      reorderQty: item.reorderQty,
      status: item.status,
    };
  });

  const csv = serializeCsv(rows, columns);
  return csvResponse(`oneace-items-${todayIsoDate()}.csv`, csv);
}
