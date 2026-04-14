import { type CsvColumn, csvResponse, serializeCsv, todayIsoDate } from "@/lib/csv";
import { db } from "@/lib/db";
import { requireActiveMembership } from "@/lib/session";

import {
  type MovementSearchParams,
  buildMovementWhere,
  parseMovementFilter,
} from "../../../movements/filter";

/**
 * GET /reports/movements/export — CSV snapshot of movements, filtered by
 * date and type via the same `parseMovementFilter` helper the report page
 * uses. No warehouse or item-q filter here (report is type/date focused).
 *
 * Cap: 20 000 rows (filtered report — user has narrowed scope).
 */

type ExportRow = {
  createdAt: string;
  type: string;
  itemSku: string;
  itemName: string;
  warehouse: string;
  toWarehouse: string | null;
  quantity: number;
  direction: number;
  reference: string | null;
  createdBy: string | null;
};

const columns: CsvColumn<ExportRow>[] = [
  { header: "Created at", value: (r) => r.createdAt },
  { header: "Type", value: (r) => r.type },
  { header: "Item SKU", value: (r) => r.itemSku },
  { header: "Item name", value: (r) => r.itemName },
  { header: "Location", value: (r) => r.warehouse },
  { header: "To location", value: (r) => r.toWarehouse },
  { header: "Qty change", value: (r) => (r.direction < 0 ? -r.quantity : r.quantity) },
  { header: "Reference", value: (r) => r.reference },
  { header: "Created by", value: (r) => r.createdBy },
];

export async function GET(request: Request) {
  const { membership } = await requireActiveMembership();

  const url = new URL(request.url);
  const rawParams: MovementSearchParams = {
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    type: url.searchParams.get("type") ?? undefined,
  };

  const filter = await parseMovementFilter(Promise.resolve(rawParams));

  const movements = await db.stockMovement.findMany({
    where: {
      organizationId: membership.organizationId,
      ...buildMovementWhere(filter),
    },
    select: {
      createdAt: true,
      type: true,
      quantity: true,
      direction: true,
      reference: true,
      item: { select: { sku: true, name: true } },
      warehouse: { select: { name: true } },
      toWarehouse: { select: { name: true } },
      createdBy: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20_000,
  });

  const rows: ExportRow[] = movements.map((m) => ({
    createdAt: m.createdAt.toISOString(),
    type: m.type,
    itemSku: m.item.sku,
    itemName: m.item.name,
    warehouse: m.warehouse.name,
    toWarehouse: m.toWarehouse?.name ?? null,
    quantity: m.quantity,
    direction: m.direction,
    reference: m.reference ?? null,
    createdBy: m.createdBy?.name ?? m.createdBy?.email ?? null,
  }));

  const csv = serializeCsv(rows, columns);
  return csvResponse(`oneace-movements-${todayIsoDate()}.csv`, csv);
}
