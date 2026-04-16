/**
 * Label rendering utilities for generating printable label data.
 *
 * This module provides functions to:
 * - Render labels from templates and entity data
 * - Generate barcodes (CODE128, EAN13, QR, etc.)
 * - Calculate multi-label page layouts
 */

import type { LabelTemplate } from "@/generated/prisma";

/**
 * Represents a single rendered label ready for printing.
 */
export interface RenderedLabel {
  id: string;
  templateId: string;
  data: Record<string, unknown>;
  barcode?: {
    format: string;
    value: string;
    encoded?: string; // Encoded barcode data
  };
  qr?: {
    value: string;
    encoded?: string; // Encoded QR data
  };
  fields: Array<{
    name: string;
    value: string;
    position?: { x: number; y: number; width?: number; height?: number };
  }>;
}

/**
 * Label field types that can be included in a label.
 */
export type LabelField = "barcode" | "qr" | "name" | "code" | "location" | "custom_text";

/**
 * Render a label from a template and entity data.
 *
 * @param template - The label template
 * @param entityType - The entity type (warehouse, bin, item, etc.)
 * @param entityData - The entity data to populate the label
 * @returns A rendered label ready for printing
 */
export function renderLabel(
  template: LabelTemplate,
  entityType: string,
  entityData: Record<string, unknown>,
): RenderedLabel {
  const layout = template.layout as Record<string, unknown>;
  const fields: RenderedLabel["fields"] = [];

  // Extract layout configuration if available
  const layoutConfig = layout.fields as Array<{
    name: string;
    type: LabelField;
    value?: string;
    position?: { x: number; y: number; width?: number; height?: number };
  }>;

  if (!layoutConfig || !Array.isArray(layoutConfig)) {
    // Default layout: just include barcode and name
    const name = entityData.name as string | undefined;
    const code = entityData.code as string | undefined;

    if (code) {
      fields.push({
        name: "code",
        value: code,
      });
    }

    if (name) {
      fields.push({
        name: "name",
        value: name,
      });
    }
  } else {
    // Apply layout configuration
    for (const field of layoutConfig) {
      let value = "";

      switch (field.type) {
        case "barcode":
          // Barcode value comes from the entity
          value = (entityData.barcodeValue as string) || (entityData.code as string) || "";
          break;

        case "name":
          value = (entityData.name as string) || "";
          break;

        case "code":
          value = (entityData.code as string) || "";
          break;

        case "location":
          // For bins: warehouse + bin code; for warehouse: just warehouse code
          if (entityType === "bin" && entityData.warehouseCode) {
            value = `${entityData.warehouseCode}/${entityData.code}`;
          } else {
            value = (entityData.code as string) || "";
          }
          break;

        case "custom_text":
          // Custom text from field config
          value = (field.value as string) || "";
          break;

        default:
          value = "";
      }

      if (value) {
        fields.push({
          name: field.name,
          value,
          position: field.position,
        });
      }
    }
  }

  // Generate barcode if needed
  const barcodeField = layoutConfig?.find((f) => f.type === "barcode");
  const barcodeValue =
    barcodeField && entityData.barcodeValue ? (entityData.barcodeValue as string) : undefined;

  const rendered: RenderedLabel = {
    id: (entityData.id as string) || "",
    templateId: template.id,
    data: entityData,
    fields,
  };

  if (barcodeValue) {
    rendered.barcode = {
      format: template.barcodeFormat,
      value: barcodeValue,
    };
  }

  return rendered;
}

/**
 * Generate a QR code value for a label.
 *
 * @param entityData - The entity data
 * @returns The QR code value
 */
export function generateQRValue(entityData: Record<string, unknown>): string {
  const id = entityData.id as string | undefined;
  const type = entityData.type as string | undefined;
  return id && type ? `${type}:${id}` : "";
}

/**
 * Generate a barcode value for a label.
 *
 * @param entityData - The entity data
 * @param format - The barcode format
 * @returns The barcode value
 */
export function generateBarcodeValue(entityData: Record<string, unknown>, format: string): string {
  const code = entityData.code as string | undefined;
  return code || "";
}

/**
 * Calculate positions for multiple labels on a page.
 *
 * @param template - The label template
 * @param itemsPerPage - Number of items per page
 * @returns An array of positions for each label
 */
export function calculateLabelPositions(
  template: LabelTemplate,
  itemsPerPage: number,
): Array<{ x: number; y: number }> {
  const positions: Array<{ x: number; y: number }> = [];
  const pageWidth = 210; // A4 width in mm
  const pageHeight = 297; // A4 height in mm
  const margin = 10; // 10mm margin

  const labelWidth = template.width || 50;
  const labelHeight = template.height || 30;

  let x = margin;
  let y = margin;
  let count = 0;

  while (count < itemsPerPage) {
    positions.push({ x, y });
    count++;

    x += labelWidth + 5; // 5mm gap between labels

    if (x + labelWidth > pageWidth - margin) {
      x = margin;
      y += labelHeight + 5; // 5mm gap between rows

      if (y + labelHeight > pageHeight - margin) {
        break; // No more space on page
      }
    }
  }

  return positions;
}

/**
 * Calculate how many labels fit on a page.
 *
 * @param labelWidth - Label width in mm
 * @param labelHeight - Label height in mm
 * @returns Object containing columns, rows, and total items per page
 */
export function calculateLabelsPerPage(
  labelWidth: number,
  labelHeight: number,
): { columns: number; rows: number; itemsPerPage: number } {
  const pageWidth = 210; // A4 width in mm
  const pageHeight = 297; // A4 height in mm
  const margin = 10; // 10mm margin
  const gap = 5; // 5mm gap between labels

  const columns = Math.floor((pageWidth - 2 * margin + gap) / (labelWidth + gap));
  const rows = Math.floor((pageHeight - 2 * margin + gap) / (labelHeight + gap));
  const itemsPerPage = columns * rows;

  return { columns, rows, itemsPerPage };
}
