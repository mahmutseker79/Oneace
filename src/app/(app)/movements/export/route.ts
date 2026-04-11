import { type CsvColumn, csvResponse, serializeCsv, todayIsoDate } from "@/lib/csv";
import { db } from "@/lib/db";
import { requireActiveMembership } from "@/lib/session";

/**
 * GET /movements/export — CSV snapshot of the most recent stock
 * movements in the active org.
 *
 * Capped at 5,000 rows to keep responses bounded. Anyone who needs
 * the full tail can filter via searchParams later; for MVP the "last
 * 5k" window is already bigger than most SMBs will touch in a year.
 */

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

export async function GET() {
  const { membership } = await requireActiveMembership();

  const movements = await db.stockMovement.findMany({
    where: { organizationId: membership.organizationId },
    include: {
      item: { select: { sku: true, name: true } },
      warehouse: { select: { name: true } },
      toWarehouse: { select: { name: true } },
      createdBy: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 5000,
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
