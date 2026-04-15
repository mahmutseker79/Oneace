/**
 * Phase E: Intelligent field mapper for CSV/Excel imports.
 *
 * Auto-detects column-to-field mappings using fuzzy matching and heuristics:
 * - Column name similarity (Levenshtein distance)
 * - Value type detection (number, date, boolean, email)
 * - Entity schema awareness
 * - User manual overrides
 */

import type { ImportEntity } from "@/generated/prisma";

export type FieldType = "string" | "number" | "date" | "boolean" | "email";

export interface FieldDefinition {
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  examples?: string[];
}

export interface FieldMapping {
  columnIndex: number;
  columnName: string;
  targetField: string;
  confidence: number;
  type: FieldType;
}

export interface AutomapResult {
  mappings: FieldMapping[];
  unmappedColumns: string[];
  confidence: number;
  warnings: string[];
}

/**
 * Define canonical fields for each import entity.
 */
const ENTITY_FIELD_DEFINITIONS: Record<ImportEntity, FieldDefinition[]> = {
  ITEM: [
    { name: "sku", label: "SKU", type: "string", required: true },
    { name: "name", label: "Product Name", type: "string", required: true },
    {
      name: "description",
      label: "Description",
      type: "string",
      required: false,
    },
    { name: "category", label: "Category", type: "string", required: false },
    { name: "unitCost", label: "Unit Cost", type: "number", required: false },
    {
      name: "reorderLevel",
      label: "Reorder Level",
      type: "number",
      required: false,
    },
  ],
  SUPPLIER: [
    { name: "name", label: "Supplier Name", type: "string", required: true },
    { name: "email", label: "Email", type: "email", required: false },
    { name: "phone", label: "Phone", type: "string", required: false },
    { name: "address", label: "Address", type: "string", required: false },
    { name: "city", label: "City", type: "string", required: false },
    { name: "country", label: "Country", type: "string", required: false },
  ],
  PURCHASE_ORDER: [
    { name: "poNumber", label: "PO Number", type: "string", required: true },
    {
      name: "supplierName",
      label: "Supplier",
      type: "string",
      required: true,
    },
    {
      name: "orderDate",
      label: "Order Date",
      type: "date",
      required: false,
    },
    { name: "dueDate", label: "Due Date", type: "date", required: false },
    {
      name: "totalAmount",
      label: "Total Amount",
      type: "number",
      required: false,
    },
    { name: "notes", label: "Notes", type: "string", required: false },
  ],
  STOCK_LEVEL: [
    {
      name: "itemSku",
      label: "Item SKU",
      type: "string",
      required: true,
    },
    { name: "warehouseId", label: "Warehouse", type: "string", required: true },
    { name: "quantity", label: "Quantity", type: "number", required: true },
    {
      name: "type",
      label: "Movement Type",
      type: "string",
      required: false,
    },
    { name: "notes", label: "Notes", type: "string", required: false },
  ],
  CATEGORY: [
    { name: "name", label: "Category Name", type: "string", required: true },
    {
      name: "description",
      label: "Description",
      type: "string",
      required: false,
    },
  ],
  WAREHOUSE: [
    { name: "name", label: "Warehouse Name", type: "string", required: true },
    { name: "address", label: "Address", type: "string", required: false },
    { name: "city", label: "City", type: "string", required: false },
    { name: "country", label: "Country", type: "string", required: false },
  ],
  CUSTOMER: [
    { name: "name", label: "Customer Name", type: "string", required: true },
    { name: "email", label: "Email", type: "email", required: false },
    { name: "phone", label: "Phone", type: "string", required: false },
    { name: "address", label: "Address", type: "string", required: false },
    { name: "city", label: "City", type: "string", required: false },
    { name: "country", label: "Country", type: "string", required: false },
  ],
};

/**
 * Calculate Levenshtein distance for string similarity.
 */
function levenshteinDistance(a: string, b: string): number {
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();
  const matrix: number[][] = [];

  for (let i = 0; i <= bLower.length; i++) {
    matrix[i] = [i];
  }

  const firstRow = matrix[0];
  if (firstRow) {
    for (let j = 0; j <= aLower.length; j++) {
      firstRow[j] = j;
    }
  }

  for (let i = 1; i <= bLower.length; i++) {
    for (let j = 1; j <= aLower.length; j++) {
      const cost = aLower[j - 1] === bLower[i - 1] ? 0 : 1;
      const row = matrix[i];
      const prevRow = matrix[i - 1];
      if (row && prevRow) {
        row[j] = Math.min(
          row[j - 1]! + 1,
          prevRow[j]! + 1,
          prevRow[j - 1]! + cost,
        );
      }
    }
  }

  const lastRow = matrix[bLower.length];
  return (lastRow && lastRow[aLower.length]) || 0;
}

/**
 * Detect field type from sample value.
 */
function detectFieldType(value: string | null | undefined): FieldType {
  if (!value) return "string";

  const trimmed = value.toString().trim();

  // Check if it's a number
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return "number";
  }

  // Check if it's a boolean
  if (/^(true|false|yes|no|1|0)$/i.test(trimmed)) {
    return "boolean";
  }

  // Check if it's an email
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return "email";
  }

  // Check if it's a date (very basic)
  if (
    /^\d{4}-\d{2}-\d{2}/.test(trimmed) ||
    /^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(trimmed)
  ) {
    return "date";
  }

  return "string";
}

/**
 * Calculate similarity score between column and field.
 */
function calculateSimilarity(columnName: string, fieldLabel: string): number {
  const colLower = columnName.toLowerCase().replace(/[_\s-]/g, "");
  const fieldLower = fieldLabel.toLowerCase().replace(/[_\s-]/g, "");

  const distance = levenshteinDistance(colLower, fieldLower);
  const maxLength = Math.max(colLower.length, fieldLower.length);

  if (maxLength === 0) return 1.0;

  return Math.max(0, 1.0 - distance / maxLength);
}

/**
 * Field mapper for intelligent auto-detection.
 */
export class FieldMapper {
  private entityFields: FieldDefinition[];

  constructor(entity: ImportEntity) {
    this.entityFields = ENTITY_FIELD_DEFINITIONS[entity] ?? [];
  }

  /**
   * Auto-map columns to fields using fuzzy matching and type detection.
   */
  automap(
    headers: string[],
    sampleRows: (string | null)[][] = [],
  ): AutomapResult {
    const mappings: FieldMapping[] = [];
    const mappedFields = new Set<string>();
    const warnings: string[] = [];

    for (let colIndex = 0; colIndex < headers.length; colIndex++) {
      const columnName = headers[colIndex]!;
      let bestMatch: FieldMapping | null = null;
      let bestScore = 0.4; // Minimum confidence threshold

      // Try to match against each field
      for (const field of this.entityFields) {
        if (mappedFields.has(field.name)) {
          continue; // Skip already mapped fields
        }

        // Name similarity score
        const similarity = calculateSimilarity(columnName, field.label);

        // Type detection score
        let typeScore = 0.5;

        if (sampleRows.length > 0) {
          const detectedType = detectFieldType(sampleRows[0]?.[colIndex]);

          if (detectedType === field.type) {
            typeScore = 1.0;
          } else if (
            (detectedType === "string" && field.type !== "email") ||
            (detectedType === "number" &&
              field.type === "number")
          ) {
            typeScore = 0.8;
          } else {
            typeScore = 0.3;
          }
        }

        // Combined score
        const combinedScore = similarity * 0.6 + typeScore * 0.4;

        if (combinedScore > bestScore) {
          bestScore = combinedScore;
          bestMatch = {
            columnIndex: colIndex,
            columnName,
            targetField: field.name,
            confidence: bestScore,
            type: detectFieldType(sampleRows[0]?.[colIndex]),
          };
        }
      }

      if (bestMatch) {
        mappings.push(bestMatch);
        mappedFields.add(bestMatch.targetField);

        if (bestMatch.confidence < 0.75) {
          warnings.push(
            `Low confidence mapping for "${columnName}" -> "${bestMatch.targetField}" (${(bestMatch.confidence * 100).toFixed(0)}%)`,
          );
        }
      }
    }

    // Check for unmapped required fields
    const unmappedRequired = this.entityFields
      .filter((f) => f.required && !mappedFields.has(f.name))
      .map((f) => f.label);

    if (unmappedRequired.length > 0) {
      warnings.push(
        `Missing required fields: ${unmappedRequired.join(", ")}`,
      );
    }

    // List unmapped columns
    const unmappedColumns = headers.filter(
      (header, idx) =>
        !mappings.find((m) => m.columnIndex === idx),
    );

    const confidence =
      mappings.length > 0
        ? mappings.reduce((sum, m) => sum + m.confidence, 0) / mappings.length
        : 0;

    return {
      mappings,
      unmappedColumns,
      confidence,
      warnings,
    };
  }

  /**
   * Manually set a field mapping.
   */
  manualMap(columnIndex: number, columnName: string, targetField: string): FieldMapping {
    const field = this.entityFields.find((f) => f.name === targetField);

    if (!field) {
      throw new Error(`Unknown field: ${targetField}`);
    }

    return {
      columnIndex,
      columnName,
      targetField,
      confidence: 1.0,
      type: field.type,
    };
  }

  /**
   * Get all available fields for this entity.
   */
  getFields(): FieldDefinition[] {
    return this.entityFields;
  }

  /**
   * Validate that a mapping has all required fields.
   */
  validateMapping(mappings: FieldMapping[]): { valid: boolean; missingFields: string[] } {
    const mappedFields = new Set(mappings.map((m) => m.targetField));
    const missingFields = this.entityFields
      .filter((f) => f.required && !mappedFields.has(f.name))
      .map((f) => f.label);

    return {
      valid: missingFields.length === 0,
      missingFields,
    };
  }
}

export default FieldMapper;
