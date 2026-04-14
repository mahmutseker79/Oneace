import { type CsvColumn, csvResponse, serializeCsv, todayIsoDate } from "@/lib/csv";
import { db } from "@/lib/db";
import { hasPlanCapability } from "@/lib/plans";
import { requireActiveMembership } from "@/lib/session";

import { type MovementSearchParams, buildMovementWhere, parseMovementFilter } from "../filter";

/**
 * GET /movements/export — CSV snapshot of stock movements in the
 * active org, optionally filtered by `?from=YYYY-MM-DD&to=YYYY-MM-DD&type=...`.
 *
 * The filter is parsed via the same `parseMovementFilter` helper the
 * /movements page uses, so the CSV a user downloads matches what
 * they currently see on screen row-for-row (modulo the row cap).
 *
 * Row cap: unfiltered exports are capped at 5,000, filtered exports
 * at 20,000. Filtered callers already told us what they want to
 * look at, so we let them pull a much bigger window; unfiltered
 * exports stay bounded so a casual click doesn't stream the entire
 * ledger for a long-running org.
 */

const UNFILTERED_LIMIT = 5000;
const FILTERED_LIMIT = 20000;

type ExportRow = {
  createdAt: string;
  type: string;
  quantity: number;
  direction: number;
  itemSku: string;
  itemName: string;
  fromWarehouse: string;
  toWarehouse: string | null;
  reference: string | null;
  note: string | null;
  createdBy: string | null;
};

const columns: CsvColumn<ExportRow>[] = [
  { header: "Created at", value: (r) => r.createdAt },
  { header: "Type", value: (r) => r.type },
  { header: "Direction", value: (r) => (r.direction > 0 ? "+" : "-") },
  { header: "Quantity", value: (r) => r.quantity },
  { header: "Item SKU", value: (r) => r.itemSku },
  { header: "Item name", value: (r) => r.itemName },
  { header: "From warehouse", value: (r) => r.fromWarehouse },
  { header: "To warehouse", value: (r) => r.toWarehouse },
  { header: "Reference", value: (r) => r.reference },
  { header: "Note", value: (r) => r.note },
  { header: "Created by", value: (r) => r.createdBy },
];

export async function GET(request: Request) {
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

  // Pull the same filter shape the /movements page uses so the CSV
  // snapshot matches the on-screen view. All five axes (Sprint 14
  // date/type, Sprint 17 warehouse, Sprint 18 item `q`) are mirrored
  // here so the Export button can deep-link into a fully narrowed
  // CSV. `parseMovementFilter` validates each axis centrally so a
  // bogus URL degrades to "no filter" instead of a 500.
  const url = new URL(request.url);
  const rawParams: MovementSearchParams = {
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    type: url.searchParams.get("type") ?? undefined,
    warehouse: url.searchParams.get("warehouse") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
  };
  const filter = await parseMovementFilter(Promise.resolve(rawParams));
  const filterActive = Boolean(
    filter.from || filter.to || filter.type || filter.warehouseId || filter.q.length > 0,
  );
  const limit = filterActive ? FILTERED_LIMIT : UNFILTERED_LIMIT;

  const movements = await db.stockMovement.findMany({
    where: {
      organizationId: membership.organizationId,
      ...buildMovementWhere(filter),
    },
    include: {
      item: { select: { sku: true, name: true } },
      warehouse: { select: { name: true } },
      toWarehouse: { select: { name: true } },
      createdBy: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const rows: ExportRow[] = movements.map((m) => ({
    createdAt: m.createdAt.toISOString(),
    type: m.type,
    quantity: m.quantity,
    direction: m.direction,
    itemSku: m.item.sku,
    itemName: m.item.name,
    fromWarehouse: m.warehouse.name,
    toWarehouse: m.toWarehouse?.name ?? null,
    reference: m.reference,
    note: m.note,
    createdBy: m.createdBy?.name ?? m.createdBy?.email ?? null,
  }));

  const csv = serializeCsv(rows, columns);
  return csvResponse(`oneace-movements-${todayIsoDate()}.csv`, csv);
}
