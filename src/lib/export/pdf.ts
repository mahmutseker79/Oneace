/**
 * PDF export utility using jsPDF and jspdf-autotable.
 *
 * Server-only — generates PDF binary responses for route handlers.
 * Includes utility functions for creating branded PDF documents with
 * tables, headers, footers, and proper formatting.
 *
 * Note on Turkish character support:
 * - Helvetica (built-in font) handles most Latin characters including Turkish
 * - For full Turkish support (Turkish-specific chars), you can add a custom font:
 *   doc.addFont('path-to-ttf', 'CustomFont', 'normal');
 *   doc.setFont('CustomFont');
 */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export interface PdfOptions {
  orgName: string;
  reportTitle: string;
  date: Date;
}

export interface TableColumn {
  header: string;
  dataKey: string;
  halign?: "left" | "center" | "right";
  valign?: "top" | "middle" | "bottom";
}

/**
 * Create a new jsPDF instance with OneAce branding.
 * Sets up default font, margin, and basic page setup.
 */
export function createPdfDocument(options: PdfOptions): jsPDF {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "letter", // 8.5" x 11"
  });

  // Set default font
  doc.setFont("helvetica", "normal");

  // Add page number and footer on each page
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addPageFooter(doc, options, i);
  }

  return doc;
}

/**
 * Add a header to the current page with org name, report title, and date.
 */
export function addPageHeader(doc: jsPDF, options: PdfOptions, pageHeight = 297): number {
  const margin = 10;
  let y = margin;

  // Organization name (bold)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(options.orgName, margin, y);
  y += 8;

  // Report title (larger)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(options.reportTitle, margin, y);
  y += 8;

  // Date
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const dateStr = options.date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  doc.text(`Generated: ${dateStr}`, margin, y);

  return y + 8; // Return position where content should start
}

/**
 * Add a footer to the specified page with page number.
 */
function addPageFooter(doc: jsPDF, _options: PdfOptions, pageNum: number): void {
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128); // Gray
  const pageText = `Page ${pageNum}`;
  doc.text(pageText, pageWidth - margin, pageHeight - 5, { align: "right" });

  // Reset color
  doc.setTextColor(0, 0, 0);
}

/**
 * Add an autoTable to the document at the current Y position.
 * Returns the final Y position after the table.
 */
export function addTable(
  doc: jsPDF,
  columns: TableColumn[],
  rows: Record<string, string | number | null | undefined>[],
  startY: number,
): number {
  const margin = 10;
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentHeight = pageHeight - margin - 15; // Leave room for footer

  autoTable(doc, {
    columns: columns.map((col) => ({
      header: col.header,
      dataKey: col.dataKey,
      halign: col.halign ?? "left",
      valign: col.valign ?? "middle",
    })),
    body: rows.map((row) =>
      columns.map((col) => {
        const val = row[col.dataKey];
        return val ?? "";
      }),
    ),
    startY,
    margin,
    theme: "grid",
    headStyles: {
      fillColor: [31, 41, 55], // Dark gray
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 10,
      halign: "left",
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [0, 0, 0],
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251], // Light gray
    },
    didDrawPage: () => {
      // Ensure page numbers are on every page
      const pageNum = doc.internal.pages.length - 1;
      if (pageNum > 1) {
        addPageFooter(doc, { orgName: "", reportTitle: "", date: new Date() }, pageNum);
      }
    },
  });

  return (doc as any).lastAutoTable?.finalY ?? startY + 20;
}

/**
 * Add a text section to the PDF.
 */
export function addTextSection(doc: jsPDF, title: string, content: string, startY: number): number {
  const margin = 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(title, margin, startY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const splitText = doc.splitTextToSize(content, 190);
  let y = startY + 7;
  for (const line of splitText) {
    doc.text(line, margin, y);
    y += 5;
  }

  return y + 5;
}

/**
 * Add a summary statistics section (key-value pairs in a grid).
 */
export function addSummaryStats(
  doc: jsPDF,
  stats: Array<{ label: string; value: string }>,
  startY: number,
): number {
  const margin = 10;
  const colWidth = 90;
  let y = startY;
  let x = margin;
  let col = 0;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  for (const stat of stats) {
    // Label (bold)
    doc.setFont("helvetica", "bold");
    doc.text(stat.label, x, y);

    // Value
    doc.setFont("helvetica", "normal");
    doc.text(stat.value, x, y + 5);

    col++;
    if (col % 2 === 0) {
      // Move to next row
      y += 15;
      x = margin;
    } else {
      // Move to next column
      x += colWidth;
    }
  }

  return y + 10;
}

/**
 * Export a stock count report to PDF.
 */
export async function exportStockCountPdf(data: {
  orgName: string;
  countName: string;
  warehouseName: string;
  date: Date;
  countDate: Date;
  variance: number;
  items: Array<{
    sku: string;
    name: string;
    expected: number;
    counted: number;
    variance: number;
  }>;
}): Promise<ArrayBuffer> {
  const doc = createPdfDocument({
    orgName: data.orgName,
    reportTitle: `Stock Count: ${data.countName}`,
    date: data.date,
  });

  let y = addPageHeader(
    doc,
    {
      orgName: data.orgName,
      reportTitle: `Stock Count: ${data.countName}`,
      date: data.date,
    },
    10,
  );

  // Summary stats
  const stats = [
    { label: "Location", value: data.warehouseName },
    { label: "Count Date", value: data.countDate.toLocaleDateString() },
    { label: "Total Variance", value: data.variance.toString() },
  ];
  y = addSummaryStats(doc, stats, y);

  // Items table
  const columns: TableColumn[] = [
    { header: "SKU", dataKey: "sku" },
    { header: "Item Name", dataKey: "name" },
    { header: "Expected", dataKey: "expected", halign: "right" },
    { header: "Counted", dataKey: "counted", halign: "right" },
    { header: "Variance", dataKey: "variance", halign: "right" },
  ];

  const rows = data.items.map((item) => ({
    sku: item.sku,
    name: item.name,
    expected: item.expected.toString(),
    counted: item.counted.toString(),
    variance: item.variance.toString(),
  }));

  addTable(doc, columns, rows, y);

  return doc.output("arraybuffer");
}

/**
 * Export a low stock report to PDF.
 */
export async function exportLowStockPdf(data: {
  orgName: string;
  date: Date;
  items: Array<{
    sku: string;
    name: string;
    supplierName: string;
    onHand: number;
    reorderPoint: number;
    shortfall: number;
    reorderQty: number;
  }>;
}): Promise<ArrayBuffer> {
  const doc = createPdfDocument({
    orgName: data.orgName,
    reportTitle: "Low Stock Report",
    date: data.date,
  });

  let y = addPageHeader(
    doc,
    {
      orgName: data.orgName,
      reportTitle: "Low Stock Report",
      date: data.date,
    },
    10,
  );

  // Summary stats
  const stats = [{ label: "Total Items Below Reorder", value: data.items.length.toString() }];
  y = addSummaryStats(doc, stats, y);

  // Items table
  const columns: TableColumn[] = [
    { header: "SKU", dataKey: "sku" },
    { header: "Item Name", dataKey: "name" },
    { header: "Supplier", dataKey: "supplierName" },
    { header: "On Hand", dataKey: "onHand", halign: "right" },
    { header: "Reorder Point", dataKey: "reorderPoint", halign: "right" },
    { header: "Shortfall", dataKey: "shortfall", halign: "right" },
  ];

  const rows = data.items.map((item) => ({
    sku: item.sku,
    name: item.name,
    supplierName: item.supplierName,
    onHand: item.onHand.toString(),
    reorderPoint: item.reorderPoint.toString(),
    shortfall: item.shortfall.toString(),
    reorderQty: item.reorderQty.toString(),
  }));

  addTable(doc, columns, rows, y);

  return doc.output("arraybuffer");
}

/**
 * Export a stock value report to PDF.
 */
export async function exportStockValuePdf(data: {
  orgName: string;
  date: Date;
  totalValue: number;
  totalUnits: number;
  currency: string;
  warehouses: Array<{
    name: string;
    value: number;
    units: number;
    items: number;
  }>;
  itemRows: Array<{
    sku: string;
    name: string;
    warehouseName: string;
    onHand: number;
    costPrice: number;
    value: number;
  }>;
}): Promise<ArrayBuffer> {
  const doc = createPdfDocument({
    orgName: data.orgName,
    reportTitle: "Stock Value Report",
    date: data.date,
  });

  let y = addPageHeader(
    doc,
    {
      orgName: data.orgName,
      reportTitle: "Stock Value Report",
      date: data.date,
    },
    10,
  );

  // Summary stats
  const stats = [
    { label: "Total Value", value: `${data.currency} ${data.totalValue.toFixed(2)}` },
    { label: "Total Units", value: data.totalUnits.toString() },
  ];
  y = addSummaryStats(doc, stats, y);

  // Warehouse summary table
  const warehouseColumns: TableColumn[] = [
    { header: "Location", dataKey: "name" },
    { header: "Items", dataKey: "items", halign: "right" },
    { header: "Units", dataKey: "units", halign: "right" },
    { header: "Value", dataKey: "value", halign: "right" },
  ];

  const warehouseRows = data.warehouses.map((w) => ({
    name: w.name,
    items: w.items.toString(),
    units: w.units.toString(),
    value: `${data.currency} ${w.value.toFixed(2)}`,
  }));

  y = addTable(doc, warehouseColumns, warehouseRows, y) + 10;

  // Item details table
  doc.addPage();
  y = addPageHeader(
    doc,
    {
      orgName: data.orgName,
      reportTitle: "Stock Value Report (Details)",
      date: data.date,
    },
    10,
  );

  const itemColumns: TableColumn[] = [
    { header: "SKU", dataKey: "sku" },
    { header: "Item Name", dataKey: "name" },
    { header: "Location", dataKey: "warehouseName" },
    { header: "On Hand", dataKey: "onHand", halign: "right" },
    { header: "Cost Price", dataKey: "costPrice", halign: "right" },
    { header: "Value", dataKey: "value", halign: "right" },
  ];

  const itemRows = data.itemRows.map((item) => ({
    sku: item.sku,
    name: item.name,
    warehouseName: item.warehouseName,
    onHand: item.onHand.toString(),
    costPrice: `${data.currency} ${item.costPrice.toFixed(2)}`,
    value: `${data.currency} ${item.value.toFixed(2)}`,
  }));

  addTable(doc, itemColumns, itemRows, y);

  return doc.output("arraybuffer");
}

/**
 * Export a movement history report to PDF.
 */
export async function exportMovementHistoryPdf(data: {
  orgName: string;
  date: Date;
  movements: Array<{
    sku: string;
    itemName: string;
    warehouseName: string;
    type: string;
    quantity: number;
    notes: string;
    date: string;
  }>;
}): Promise<ArrayBuffer> {
  const doc = createPdfDocument({
    orgName: data.orgName,
    reportTitle: "Stock Movement History",
    date: data.date,
  });

  let y = addPageHeader(
    doc,
    {
      orgName: data.orgName,
      reportTitle: "Stock Movement History",
      date: data.date,
    },
    10,
  );

  // Summary stats
  const stats = [{ label: "Total Movements", value: data.movements.length.toString() }];
  y = addSummaryStats(doc, stats, y);

  // Movements table
  const columns: TableColumn[] = [
    { header: "Date", dataKey: "date" },
    { header: "SKU", dataKey: "sku" },
    { header: "Item", dataKey: "itemName" },
    { header: "Location", dataKey: "warehouseName" },
    { header: "Type", dataKey: "type" },
    { header: "Qty", dataKey: "quantity", halign: "right" },
  ];

  const rows = data.movements.map((mov) => ({
    date: mov.date,
    sku: mov.sku,
    itemName: mov.itemName,
    warehouseName: mov.warehouseName,
    type: mov.type,
    quantity: mov.quantity.toString(),
  }));

  addTable(doc, columns, rows, y);

  return doc.output("arraybuffer");
}

/**
 * Export a bin inventory report to PDF.
 */
export async function exportBinInventoryPdf(data: {
  orgName: string;
  date: Date;
  locations: Array<{
    name: string;
    bins: Array<{
      code: string;
      items: Array<{
        sku: string;
        name: string;
        quantity: number;
      }>;
    }>;
  }>;
}): Promise<ArrayBuffer> {
  const doc = createPdfDocument({
    orgName: data.orgName,
    reportTitle: "Bin Inventory Report",
    date: data.date,
  });

  const pageY = addPageHeader(
    doc,
    {
      orgName: data.orgName,
      reportTitle: "Bin Inventory Report",
      date: data.date,
    },
    10,
  );

  const columns: TableColumn[] = [
    { header: "Location", dataKey: "location" },
    { header: "Bin", dataKey: "bin" },
    { header: "SKU", dataKey: "sku" },
    { header: "Item", dataKey: "itemName" },
    { header: "Quantity", dataKey: "quantity", halign: "right" },
  ];

  const rows: Record<string, string>[] = [];

  for (const location of data.locations) {
    for (const bin of location.bins) {
      for (const item of bin.items) {
        rows.push({
          location: location.name,
          bin: bin.code,
          sku: item.sku,
          itemName: item.name,
          quantity: item.quantity.toString(),
        });
      }
    }
  }

  addTable(doc, columns, rows, pageY);

  return doc.output("arraybuffer");
}

/**
 * Export a purchase order to PDF.
 */
export async function exportPurchaseOrderPdf(data: {
  orgName: string;
  poNumber: string;
  supplierName: string;
  date: Date;
  lines: Array<{
    sku: string;
    itemName: string;
    quantity: number;
    unitPrice: number;
    currency: string;
  }>;
}): Promise<ArrayBuffer> {
  const doc = createPdfDocument({
    orgName: data.orgName,
    reportTitle: `Purchase Order: ${data.poNumber}`,
    date: data.date,
  });

  let y = addPageHeader(
    doc,
    {
      orgName: data.orgName,
      reportTitle: `Purchase Order: ${data.poNumber}`,
      date: data.date,
    },
    10,
  );

  // PO details
  const stats = [
    { label: "Supplier", value: data.supplierName },
    { label: "PO Date", value: data.date.toLocaleDateString() },
  ];
  y = addSummaryStats(doc, stats, y);

  // Line items table
  const columns: TableColumn[] = [
    { header: "SKU", dataKey: "sku" },
    { header: "Item", dataKey: "itemName" },
    { header: "Quantity", dataKey: "quantity", halign: "right" },
    { header: "Unit Price", dataKey: "unitPrice", halign: "right" },
    { header: "Total", dataKey: "total", halign: "right" },
  ];

  const rows = data.lines.map((line) => ({
    sku: line.sku,
    itemName: line.itemName,
    quantity: line.quantity.toString(),
    unitPrice: `${line.currency} ${line.unitPrice.toFixed(2)}`,
    total: `${line.currency} ${(line.quantity * line.unitPrice).toFixed(2)}`,
  }));

  const totalValue = data.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  rows.push({
    sku: "",
    itemName: "",
    quantity: "",
    unitPrice: "TOTAL",
    total: `${data.lines[0]?.currency || "USD"} ${totalValue.toFixed(2)}`,
  });

  addTable(doc, columns, rows, y);

  return doc.output("arraybuffer");
}
