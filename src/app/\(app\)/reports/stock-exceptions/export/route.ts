import { db } from "@/lib/db";
import { hasPlanCapability } from "@/lib/plans";
import { requireActiveMembership } from "@/lib/session";
import { serializeCsv, csvResponse, todayIsoDate } from "@/lib/csv";
import type { CsvColumn } from "@/lib/csv";

type ExportRow = {
  sku: string;
  itemName: string;
  warehouse: string;
  currentQty: string;
  lastMovement: string;
  status: string;
};

export async function GET() {
  const { membership } = await requireActiveMembership();

  const exportPlan = membership.organization.plan as "FREE" | "PRO" | "BUSINESS";
  if (!hasPlanCapability(exportPlan, "exports")) {
    return new Response(
      JSON.stringify({ error: "Exports are available on Pro and Business plans." }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }

  const stockLevels = await db.stockLevel.findMany({
    where: {
      organizationId: membership.organizationId,
      quantity: { lte: 0 },
    },
    select: {
      id: true,
      quantity: true,
      itemId: true,
      item: { select: { sku: true, name: true } },
      warehouse: { select: { name: true } },
    },
    orderBy: [{ quantity: "asc" }],
  });

  const itemIds = stockLevels.map((sl) => sl.itemId);
  const lastMovements = await db.stockMovement.findMany({
    where: {
      organizationId: membership.organizationId,
      itemId: { in: itemIds },
    },
    select: {
      itemId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    distinct: ["itemId"],
  });

  const lastMovementMap = new Map<string, string>();
  const dateFmt = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  for (const m of lastMovements) {
    lastMovementMap.set(m.itemId, dateFmt.format(m.createdAt));
  }

  const rows: ExportRow[] = stockLevels.map((sl) => ({
    sku: sl.item.sku,
    itemName: sl.item.name,
    warehouse: sl.warehouse.name,
    currentQty: String(sl.quantity),
    lastMovement: lastMovementMap.get(sl.itemId) ?? "",
    status: sl.quantity < 0 ? "NEGATIVE" : "ZERO",
  }));

  const columns: CsvColumn<ExportRow>[] = [
    { header: "SKU", value: (r) => r.sku },
    { header: "Item Name", value: (r) => r.itemName },
    { header: "Warehouse", value: (r) => r.warehouse },
    { header: "Current Qty", value: (r) => r.currentQty },
    { header: "Last Movement", value: (r) => r.lastMovement },
    { header: "Status", value: (r) => r.status },
  ];

  const csv = serializeCsv(rows, columns);
  const filename = `stock-exceptions-${todayIsoDate()}.csv`;

  return csvResponse(filename, csv);
}
