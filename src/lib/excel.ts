/**
 * Excel export helper using exceljs.
 *
 * Server-only — generates .xlsx binary responses for route handlers.
 * Mirrors the pattern from src/lib/csv.ts but with richer formatting.
 */

// @ts-expect-error — exceljs has no bundled types
import ExcelJS from "exceljs";

export type ExcelColumn<T> = {
  header: string;
  key: string;
  value: (row: T) => string | number | boolean | null | undefined;
  width?: number;
  numFmt?: string;
};

/**
 * Build a standard OneAce branded workbook with one data sheet.
 */
export async function buildExcelWorkbook<T>(
  sheetName: string,
  rows: T[],
  columns: ExcelColumn<T>[],
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "OneAce";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName);

  // Define columns
  sheet.columns = columns.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width ?? 18,
  }));

  // Style header row
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, size: 11 };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1F2937" },
  };
  headerRow.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
  headerRow.alignment = { vertical: "middle" };
  headerRow.height = 28;

  // Add data rows
  for (const row of rows) {
    const values: Record<string, unknown> = {};
    for (const col of columns) {
      values[col.key] = col.value(row) ?? "";
    }
    sheet.addRow(values);
  }

  // Apply number formats
  for (const col of columns) {
    if (col.numFmt) {
      const colIdx = columns.indexOf(col) + 1;
      for (let rowIdx = 2; rowIdx <= rows.length + 1; rowIdx++) {
        const cell = sheet.getCell(rowIdx, colIdx);
        cell.numFmt = col.numFmt;
      }
    }
  }

  // Auto-filter
  if (rows.length > 0) {
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: rows.length + 1, column: columns.length },
    };
  }

  // Freeze header row
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  return workbook;
}

/**
 * Return a standard Response with the right headers for an .xlsx download.
 */
export async function excelResponse(
  filename: string,
  workbook: ExcelJS.Workbook,
): Promise<Response> {
  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}
