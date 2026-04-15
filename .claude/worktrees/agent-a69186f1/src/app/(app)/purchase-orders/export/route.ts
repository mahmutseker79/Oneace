import { type CsvColumn, csvResponse, serializeCsv, todayIsoDate } from "@/lib/csv";
import { db } from "@/lib/db";
import { requireActiveMembership } from "@/lib/session";

import {
  type PurchaseOrderSearchParams,
  buildPurchaseOrderWhere,
  parsePurchaseOrderFilter,
} from "../filter";

/**
 * GET /purchase-orders/export — CSV snapshot of purchase orders in
 * the active org, optionally filtered by
 * `?status=...&supplier=...&q=...`.
 *
 * Mirrors the Sprint 14 `/movements/export` shape: same filter
 * parser the page uses, same "filtered callers get a much bigger
 * row cap" policy. The CSV a user downloads matches what they
 * currently see on screen row-for-row (modulo the cap).
 *
 * One row per PO (not per line). Totals are computed over the
 * loaded lines so analysts don't have to re-join line data
 * themselves — this is the same money figure the on-screen table
 * renders.
 *
 * Row cap: unfiltered 2,000, filtered 10,000. Lower than
 * movements (5k/20k) because each PO row carries aggregated line
 * data and we'd rather keep the per-PO query bounded than stream
 * a decade of procurement history in one click.
 */

const UNFILTERED_LIMIT = 2000;
const FILTERED_LIMIT = 10000;

type ExportRow = {
  poNumber: string;
  status: string;
  currency: string;
  supplierName: string;
  warehouseName: string;
  orderedAt: string;
  expectedAt: string | null;
  receivedAt: string | null;
  cancelledAt: string | null;
  lineCount: number;
  totalQuantity: number;
  totalValue: string;
  notes: string | null;
  createdBy: string | null;
};

const columns: CsvColumn<ExportRow>[] = [
  { header: "PO number", value: (r) => r.poNumber },
  { header: "Status", value: (r) => r.status },
  { header: "Currency", value: (r) => r.currency },
  { header: "Supplier", value: (r) => r.supplierName },
  { header: "Destination warehouse", value: (r) => r.warehouseName },
  { header: "Ordered at", value: (r) => r.orderedAt },
  { header: "Expected at", value: (r) => r.expectedAt },
  { header: "Received at", value: (r) => r.receivedAt },
  { header: "Cancelled at", value: (r) => r.cancelledAt },
  { header: "Line count", value: (r) => r.lineCount },
  { header: "Total quantity", value: (r) => r.totalQuantity },
  { header: "Total value", value: (r) => r.totalValue },
  { header: "Notes", value: (r) => r.notes },
  { header: "Created by", value: (r) => r.createdBy },
];

export async function GET(request: Request) {
  const { membership } = await requireActiveMembership();

  // Reuse the page filter so the CSV snapshot matches the on-
  // screen view. `parsePurchaseOrderFilter` takes a Promise to
  // stay symmetrical with the page's `searchParams: Promise<>`
  // shape, so wrap our eagerly-read params.
  const url = new URL(request.url);
  const rawParams: PurchaseOrderSearchParams = {
    status: url.searchParams.get("status") ?? undefined,
    supplier: url.searchParams.get("supplier") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
  };
  const filter = await parsePurchaseOrderFilter(Promise.resolve(rawParams));
  const filterActive = Boolean(filter.status || filter.supplierId || filter.q.length > 0);
  const limit = filterActive ? FILTERED_LIMIT : UNFILTERED_LIMIT;

  const orders = await db.purchaseOrder.findMany({
    where: {
      organizationId: membership.organizationId,
      ...buildPurchaseOrderWhere(filter),
    },
    include: {
      supplier: { select: { name: true } },
      warehouse: { select: { name: true } },
      lines: { select: { orderedQty: true, unitCost: true } },
      createdBy: { select: { name: true, email: true } },
    },
    orderBy: { orderedAt: "desc" },
    take: limit,
  });

  const rows: ExportRow[] = orders.map((po) => {
    let totalQuantity = 0;
    let totalValue = 0;
    for (const line of po.lines) {
      totalQuantity += line.orderedQty;
      totalValue += line.orderedQty * Number(line.unitCost);
    }
    return {
      poNumber: po.poNumber,
      status: po.status,
      currency: po.currency,
      supplierName: po.supplier.name,
      warehouseName: po.warehouse.name,
      orderedAt: po.orderedAt.toISOString(),
      expectedAt: po.expectedAt?.toISOString() ?? null,
      receivedAt: po.receivedAt?.toISOString() ?? null,
      cancelledAt: po.cancelledAt?.toISOString() ?? null,
      lineCount: po.lines.length,
      totalQuantity,
      // Fixed-two decimal because amounts are stored as
      // `Decimal(12, 2)` in the schema. Stringify here so the
      // CSV carries exactly the rounding the DB already enforces
      // and spreadsheets don't reintroduce floating-point noise.
      totalValue: totalValue.toFixed(2),
      notes: po.notes,
      createdBy: po.createdBy?.name ?? po.createdBy?.email ?? null,
    };
  });

  const csv = serializeCsv(rows, columns);
  return csvResponse(`oneace-purchase-orders-${todayIsoDate()}.csv`, csv);
}
