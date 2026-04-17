/**
 * Phase E: Export workflow server actions.
 *
 * Handle exports of inventory data in CSV and XLSX formats.
 */

"use server";

import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";
import { recordAudit } from "@/lib/audit";
import { z } from "zod";
import ExcelJS from "exceljs";

export type ActionResult<T = unknown> = { ok: true; data: T } | { ok: false; error: string };

// For serialization, we need to convert Buffer to base64 string
type ExportData = string | { type: "xlsx"; base64: string };

const exportSchema = z.object({
  format: z.enum(["csv", "xlsx"]),
});

const stockLevelExportSchema = exportSchema.extend({
  warehouseId: z.string().cuid().optional(),
  status: z.enum(["AVAILABLE", "HOLD", "DAMAGED", "QUARANTINE", "EXPIRED", "IN_TRANSIT", "RESERVED"]).optional(),
});

const movementExportSchema = exportSchema.extend({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  type: z.enum(["RECEIPT", "ISSUE", "ADJUSTMENT", "TRANSFER", "COUNT", "BIN_TRANSFER"]).optional(),
});

/**
 * Convert data to CSV format.
 */
function toCSV(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const escapeCsvField = (field: string | number | null | undefined): string => {
    if (field === null || field === undefined) return "";
    const str = String(field);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvHeaders = headers.map(escapeCsvField).join(",");
  const csvRows = rows.map((row) => row.map(escapeCsvField).join(",")).join("\n");

  return `${csvHeaders}\n${csvRows}`;
}

/**
 * Create an Excel workbook with headers and data.
 */
async function createExcelWorkbook(
  sheetName: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  worksheet.addRow(headers);

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  };

  for (const row of rows) {
    worksheet.addRow(row);
  }

  worksheet.columns.forEach((column) => {
    let maxLength = 0;
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const cellLength = String(cell.value || "").length;
      if (cellLength > maxLength) maxLength = cellLength;
    });
    column.width = Math.min(maxLength + 2, 50);
  });

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

/**
 * Export items in CSV or XLSX format.
 */
export async function exportItemsAction(input: unknown): Promise<ActionResult<ExportData>> {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "reports.export")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const parsed = exportSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input" };
  }

  const { format } = parsed.data;

  try {
    const items = await db.item.findMany({
      where: { organizationId: membership.organizationId },
      select: {
        sku: true,
        name: true,
        description: true,
        unit: true,
        costPrice: true,
        salePrice: true,
        reorderPoint: true,
        reorderQty: true,
        status: true,
        category: { select: { name: true } },
      },
      orderBy: { sku: "asc" },
    });

    const headers = [
      "SKU",
      "Name",
      "Description",
      "Unit",
      "Cost Price",
      "Sale Price",
      "Reorder Point",
      "Reorder Qty",
      "Status",
      "Category",
    ];

    const rows = items.map((item) => [
      item.sku,
      item.name,
      item.description || "",
      item.unit,
      item.costPrice?.toString() || "",
      item.salePrice?.toString() || "",
      item.reorderPoint,
      item.reorderQty,
      item.status,
      item.category?.name || "",
    ]);

    await recordAudit({
      organizationId: membership.organizationId,
      actorId: null,
      action: "account.data_export",
      entityType: "item",
      metadata: { format, count: items.length },
    });

    if (format === "csv") {
      return { ok: true, data: toCSV(headers, rows) };
    } else {
      const buffer = await createExcelWorkbook("Items", headers, rows);
      return { ok: true, data: { type: "xlsx", base64: buffer.toString("base64") } };
    }
  } catch (error) {
    console.error("Failed to export items", error);
    return { ok: false, error: "Failed to export items" };
  }
}

/**
 * Export stock levels in CSV or XLSX format.
 */
export async function exportStockLevelsAction(input: unknown): Promise<ActionResult<ExportData>> {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "reports.export")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const parsed = stockLevelExportSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input" };
  }

  const { format, warehouseId, status } = parsed.data;

  try {
    const stockLevels = await db.stockLevel.findMany({
      where: {
        organizationId: membership.organizationId,
        ...(warehouseId && { warehouseId }),
        ...(status && { stockStatus: status }),
      },
      select: {
        item: { select: { sku: true, name: true } },
        warehouse: { select: { code: true, name: true } },
        bin: { select: { code: true } },
        quantity: true,
        reservedQty: true,
        stockStatus: true,
      },
      orderBy: [{ warehouse: { code: "asc" } }, { item: { sku: "asc" } }],
    });

    const headers = ["Warehouse Code", "Warehouse Name", "Bin Code", "Item SKU", "Item Name", "Quantity", "Reserved", "Status"];

    const rows = stockLevels.map((sl) => [
      sl.warehouse.code,
      sl.warehouse.name,
      sl.bin?.code || "",
      sl.item.sku,
      sl.item.name,
      sl.quantity,
      sl.reservedQty,
      sl.stockStatus,
    ]);

    await recordAudit({
      organizationId: membership.organizationId,
      actorId: null,
      action: "account.data_export",
      entityType: "stock_level",
      metadata: { format, count: stockLevels.length },
    });

    if (format === "csv") {
      return { ok: true, data: toCSV(headers, rows) };
    } else {
      const buffer = await createExcelWorkbook("Stock Levels", headers, rows);
      return { ok: true, data: { type: "xlsx", base64: buffer.toString("base64") } };
    }
  } catch (error) {
    console.error("Failed to export stock levels", error);
    return { ok: false, error: "Failed to export stock levels" };
  }
}

/**
 * Export stock movements in CSV or XLSX format.
 */
export async function exportMovementsAction(input: unknown): Promise<ActionResult<ExportData>> {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "reports.export")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const parsed = movementExportSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input" };
  }

  const { format, startDate, endDate, type } = parsed.data;

  try {
    const movements = await db.stockMovement.findMany({
      where: {
        organizationId: membership.organizationId,
        ...(startDate && { createdAt: { gte: new Date(startDate) } }),
        ...(endDate && { createdAt: { lte: new Date(endDate) } }),
        ...(type && { type }),
      },
      select: {
        createdAt: true,
        type: true,
        item: { select: { sku: true, name: true } },
        warehouse: { select: { code: true, name: true } },
        quantity: true,
        direction: true,
        reference: true,
        note: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const headers = ["Date", "Type", "Item SKU", "Item Name", "Warehouse", "Quantity", "Direction", "Reference", "Note"];

    const rows = movements.map((m) => [
      m.createdAt.toISOString().split("T")[0],
      m.type,
      m.item.sku,
      m.item.name,
      m.warehouse.code,
      m.quantity,
      m.direction === 1 ? "In" : "Out",
      m.reference || "",
      m.note || "",
    ]);

    await recordAudit({
      organizationId: membership.organizationId,
      actorId: null,
      action: "account.data_export",
      entityType: "stock_movement",
      metadata: { format, count: movements.length },
    });

    if (format === "csv") {
      return { ok: true, data: toCSV(headers, rows) };
    } else {
      const buffer = await createExcelWorkbook("Movements", headers, rows);
      return { ok: true, data: { type: "xlsx", base64: buffer.toString("base64") } };
    }
  } catch (error) {
    console.error("Failed to export movements", error);
    return { ok: false, error: "Failed to export movements" };
  }
}

/**
 * Export purchase orders in CSV or XLSX format.
 */
export async function exportPurchaseOrdersAction(input: unknown): Promise<ActionResult<ExportData>> {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "reports.export")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const parsed = exportSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input" };
  }

  const { format } = parsed.data;

  try {
    const purchaseOrders = await db.purchaseOrder.findMany({
      where: { organizationId: membership.organizationId },
      select: {
        poNumber: true,
        status: true,
        supplier: { select: { name: true, code: true } },
        warehouse: { select: { name: true } },
        orderedAt: true,
        expectedAt: true,
        receivedAt: true,
        currency: true,
        notes: true,
      },
      orderBy: { orderedAt: "desc" },
    });

    const headers = [
      "PO Number",
      "Status",
      "Supplier Name",
      "Supplier Code",
      "Warehouse",
      "Ordered Date",
      "Expected Date",
      "Received Date",
      "Currency",
      "Notes",
    ];

    const rows = purchaseOrders.map((po) => [
      po.poNumber,
      po.status,
      po.supplier.name,
      po.supplier.code || "",
      po.warehouse.name,
      po.orderedAt.toISOString().split("T")[0],
      po.expectedAt?.toISOString().split("T")[0] || "",
      po.receivedAt?.toISOString().split("T")[0] || "",
      po.currency,
      po.notes || "",
    ]);

    await recordAudit({
      organizationId: membership.organizationId,
      actorId: null,
      action: "account.data_export",
      entityType: "purchase_order",
      metadata: { format, count: purchaseOrders.length },
    });

    if (format === "csv") {
      return { ok: true, data: toCSV(headers, rows) };
    } else {
      const buffer = await createExcelWorkbook("Purchase Orders", headers, rows);
      return { ok: true, data: { type: "xlsx", base64: buffer.toString("base64") } };
    }
  } catch (error) {
    console.error("Failed to export purchase orders", error);
    return { ok: false, error: "Failed to export purchase orders" };
  }
}
