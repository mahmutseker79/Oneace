import { csvResponse, serializeCsv, todayIsoDate } from "@/lib/csv";
import type { CsvColumn } from "@/lib/csv";
import { db } from "@/lib/db";
import { hasPlanCapability } from "@/lib/plans";
import { requireActiveMembership } from "@/lib/session";

type ExportRow = {
  sku: string;
  itemName: string;
  warehouse: string;
  status: string;
  quantity: string;
  unitCost: string;
  totalValue: string;
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
    where: { organizationId: membership.organizationId },
    select: {
      id: true,
      quantity: true,
      stockStatus: true,
      item: { select: { sku: true, name: true, costPrice: true } },
      warehouse: { select: { name: true } },
    },
  });

  const rows: ExportRow[] = stockLevels.map((level) => {
    const status = level.stockStatus || "AVAILABLE";
    const costNum = level.item.costPrice ? Number(level.item.costPrice.toString()) : 0;
    const totalValue = level.quantity * costNum;

    return {
      sku: level.item.sku,
      itemName: level.item.name,
      warehouse: level.warehouse.name,
      status,
      quantity: String(level.quantity),
      unitCost: String(costNum),
      totalValue: String(totalValue),
    };
  });

  const columns: CsvColumn<ExportRow>[] = [
    { header: "SKU", value: (r) => r.sku },
    { header: "Item Name", value: (r) => r.itemName },
    { header: "Warehouse", value: (r) => r.warehouse },
    { header: "Status", value: (r) => r.status },
    { header: "Quantity", value: (r) => r.quantity },
    { header: "Unit Cost", value: (r) => r.unitCost },
    { header: "Total Value", value: (r) => r.totalValue },
  ];

  const csv = serializeCsv(rows, columns);
  const filename = `stock-by-status-${todayIsoDate()}.csv`;

  return csvResponse(filename, csv);
}
