import { db } from "@/lib/db";
import { type ExcelColumn, buildExcelWorkbook, excelResponse, todayIsoDate } from "@/lib/excel";
import { requireActiveMembership } from "@/lib/session";

type ExportRow = {
  sku: string;
  name: string;
  supplierName: string;
  onHand: number;
  reorderPoint: number;
  shortfall: number;
  reorderQty: number;
};

const columns: ExcelColumn<ExportRow>[] = [
  { header: "SKU", key: "sku", value: (r) => r.sku, width: 16 },
  { header: "Name", key: "name", value: (r) => r.name, width: 28 },
  { header: "Preferred supplier", key: "supplier", value: (r) => r.supplierName, width: 22 },
  { header: "On hand", key: "onHand", value: (r) => r.onHand, width: 12 },
  { header: "Reorder point", key: "reorderPoint", value: (r) => r.reorderPoint, width: 14 },
  { header: "Shortfall", key: "shortfall", value: (r) => r.shortfall, width: 12 },
  { header: "Reorder qty", key: "reorderQty", value: (r) => r.reorderQty, width: 12 },
];

export async function GET() {
  const { membership } = await requireActiveMembership();

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
        supplierName: item.preferredSupplier?.name ?? "",
        onHand,
        reorderPoint: item.reorderPoint,
        shortfall: item.reorderPoint - onHand,
        reorderQty: item.reorderQty,
      };
    })
    .filter((row) => row.reorderPoint > 0 && row.onHand <= row.reorderPoint)
    .sort((a, b) => b.shortfall - a.shortfall);

  const workbook = await buildExcelWorkbook("Low stock", rows, columns);
  return excelResponse(`oneace-low-stock-${todayIsoDate()}.xlsx`, workbook);
}
