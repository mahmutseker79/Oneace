import { db } from "@/lib/db";
import { type ExcelColumn, buildExcelWorkbook, excelResponse, todayIsoDate } from "@/lib/excel";
import { requireActiveMembership } from "@/lib/session";

type ExportRow = {
  warehouseName: string;
  warehouseCode: string;
  sku: string;
  name: string;
  unit: string;
  onHand: number;
  costPrice: number | null;
  currency: string;
  valueAtCost: number | null;
};

const columns: ExcelColumn<ExportRow>[] = [
  { header: "Warehouse", key: "warehouse", value: (r) => r.warehouseName, width: 20 },
  { header: "Warehouse code", key: "whCode", value: (r) => r.warehouseCode, width: 14 },
  { header: "SKU", key: "sku", value: (r) => r.sku, width: 16 },
  { header: "Name", key: "name", value: (r) => r.name, width: 28 },
  { header: "Unit", key: "unit", value: (r) => r.unit, width: 10 },
  { header: "On hand", key: "onHand", value: (r) => r.onHand, width: 12 },
  {
    header: "Cost price",
    key: "costPrice",
    value: (r) => r.costPrice,
    width: 14,
    numFmt: "#,##0.00",
  },
  { header: "Currency", key: "currency", value: (r) => r.currency, width: 10 },
  {
    header: "Value at cost",
    key: "valueAtCost",
    value: (r) => r.valueAtCost,
    width: 16,
    numFmt: "#,##0.00",
  },
];

export async function GET() {
  const { membership } = await requireActiveMembership();

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
      rows.push({
        warehouseName: level.warehouse.name,
        warehouseCode: level.warehouse.code,
        sku: item.sku,
        name: item.name,
        unit: item.unit,
        onHand: level.quantity,
        costPrice: costNum,
        currency: item.currency,
        valueAtCost: costNum != null ? costNum * level.quantity : null,
      });
    }
  }

  rows.sort((a, b) => {
    const w = a.warehouseName.localeCompare(b.warehouseName);
    return w !== 0 ? w : a.name.localeCompare(b.name);
  });

  const workbook = await buildExcelWorkbook("Stock value", rows, columns);
  return excelResponse(`oneace-stock-value-${todayIsoDate()}.xlsx`, workbook);
}
