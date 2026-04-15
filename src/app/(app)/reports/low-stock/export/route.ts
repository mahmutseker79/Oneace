import { type CsvColumn, csvResponse, serializeCsv, todayIsoDate } from "@/lib/csv";
import { db } from "@/lib/db";
import { hasPlanCapability } from "@/lib/plans";
import { requireActiveMembership } from "@/lib/session";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

/**
 * GET /reports/low-stock/export — CSV of every ACTIVE item whose on-hand
 * is at or below its reorder point.
 *
 * Logic is mirrored from `/reports/low-stock/page.tsx` so a user who
 * downloads the CSV gets exactly the rows they see on screen (modulo the
 * grouping, which a flat CSV can't express). Sorted by shortfall desc
 * so the most urgent lines are at the top.
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

  const items = await db.item.findMany({
    where: { organizationId: membership.organizationId, status: "ACTIVE" },
    select: {
      sku: true,
      name: true,
      reorderPoint: true,
      reorderQty: true,
      preferredSupplier: { select: { name: true } },
      stockLevels: { select: { quantity: true } },
    },
  });

  const rows: ExportRow[] = items
    .map((item) => {
      const onHand = item.stockLevels.reduce((acc, l) => acc + l.quantity, 0);
      return {
        sku: item.sku,
        name: item.name,
        supplierName: item.preferredSupplier?.name ?? null,
        onHand,
        reorderPoint: item.reorderPoint,
        shortfall: item.reorderPoint - onHand,
        reorderQty: item.reorderQty,
      };
    })
    .filter((row) => row.reorderPoint > 0 && row.onHand <= row.reorderPoint)
    .sort((a, b) => b.shortfall - a.shortfall);

  const csv = serializeCsv(rows, columns);
  return csvResponse(`oneace-low-stock-${todayIsoDate()}.csv`, csv);
}
