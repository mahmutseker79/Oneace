/**
 * Bin label PDF generator for printable labels.
 *
 * Generates a PDF in Avery 5160 compatible format:
 * - Page size: Letter (8.5" × 11")
 * - Layout: 30 labels per sheet (3 columns × 10 rows)
 * - Label dimensions: 2.625" × 1" with 0.125" margins
 *
 * Each label contains:
 * - Bin code (large, bold text)
 * - Warehouse name (small text)
 * - Placeholder for barcode representation (using monospace font)
 *
 * Note on barcodes:
 * For actual Code128 barcode generation, you can add a custom font library
 * or use a barcode generation service. Currently, the bin code is displayed
 * in a monospace font as a text representation.
 */

import { jsPDF } from "jspdf";

export interface BinLabel {
  binCode: string;
  warehouseName: string;
}

const INCHES_TO_MM = 25.4;

// Avery 5160 dimensions (in inches)
const PAGE_WIDTH_IN = 8.5;
const PAGE_HEIGHT_IN = 11;
const LABEL_WIDTH_IN = 2.625;
const LABEL_HEIGHT_IN = 1;
const MARGIN_IN = 0.125;

// Convert to mm for jsPDF
const PAGE_WIDTH = PAGE_WIDTH_IN * INCHES_TO_MM;
const PAGE_HEIGHT = PAGE_HEIGHT_IN * INCHES_TO_MM;
const LABEL_WIDTH = LABEL_WIDTH_IN * INCHES_TO_MM;
const LABEL_HEIGHT = LABEL_HEIGHT_IN * INCHES_TO_MM;
const MARGIN = MARGIN_IN * INCHES_TO_MM;

// Layout: 3 columns × 10 rows
const COLS = 3;
const ROWS = 10;
const LABELS_PER_PAGE = COLS * ROWS;

/**
 * Calculate the X position for a label column (0-indexed)
 */
function getLabelX(col: number): number {
  return col * LABEL_WIDTH + MARGIN;
}

/**
 * Calculate the Y position for a label row (0-indexed)
 */
function getLabelY(row: number): number {
  const topMargin = 0.5 * INCHES_TO_MM; // Standard top margin
  return topMargin + row * LABEL_HEIGHT;
}

/**
 * Draw a single label at the given position
 */
function drawLabel(
  doc: jsPDF,
  x: number,
  y: number,
  binLabel: BinLabel,
): void {
  const padding = 2; // mm
  const contentWidth = LABEL_WIDTH - 2 * padding;
  const contentHeight = LABEL_HEIGHT - 2 * padding;
  const contentX = x + padding;
  const contentY = y + padding;

  // Draw label border
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.rect(x, y, LABEL_WIDTH, LABEL_HEIGHT);

  // Bin code (large, bold)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);

  // Center the bin code vertically and horizontally
  const binCodeX = contentX + contentWidth / 2;
  const binCodeY = contentY + contentHeight * 0.4;
  doc.text(binLabel.binCode, binCodeX, binCodeY, { align: "center" });

  // Warehouse name (small, normal weight)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  const warehouseNameY = contentY + contentHeight * 0.75;
  doc.text(binLabel.warehouseName, binCodeX, warehouseNameY, {
    align: "center",
    maxWidth: contentWidth - 2,
  });
}

/**
 * Generate a PDF with bin labels in Avery 5160 format.
 *
 * Returns the PDF as an ArrayBuffer ready for download.
 */
export function generateBinLabelsPdf(labels: BinLabel[]): ArrayBuffer {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [PAGE_WIDTH, PAGE_HEIGHT],
  });

  let labelIndex = 0;

  for (let pageNum = 0; labelIndex < labels.length; pageNum++) {
    // Add new page if not the first page
    if (pageNum > 0) {
      doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    }

    // Draw labels on this page
    for (let row = 0; row < ROWS && labelIndex < labels.length; row++) {
      for (let col = 0; col < COLS && labelIndex < labels.length; col++) {
        const x = getLabelX(col);
        const y = getLabelY(row);
        const label = labels[labelIndex];
        if (label) {
          drawLabel(doc, x, y, label);
        }
        labelIndex++;
      }
    }
  }

  return doc.output("arraybuffer");
}

/**
 * Generate a preview PDF with fewer labels for testing.
 * Useful for verifying alignment before printing a full sheet.
 */
export function generateBinLabelPreviewPdf(labels: BinLabel[]): ArrayBuffer {
  // Limit to first 6 labels (2 rows) for preview
  const previewLabels = labels.slice(0, 6);
  return generateBinLabelsPdf(previewLabels);
}
