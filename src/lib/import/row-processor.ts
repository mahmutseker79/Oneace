/**
 * Phase E: Row-by-row validation and transformation.
 *
 * Processes CSV/Excel rows with:
 * - Field type coercion and validation
 * - Required field checking
 * - Custom transformation logic
 * - Error collection with row/column context
 */

import type { ImportEntity } from "@/generated/prisma";
import type { FieldMapping } from "@/lib/import/field-mapper";
import { z } from "zod";

export interface RowValidationError {
  rowIndex: number;
  field: string;
  columnIndex: number;
  value: string | null;
  error: string;
}

export interface ValidatedRow {
  rowIndex: number;
  data: Record<string, unknown>;
  valid: boolean;
  errors: RowValidationError[];
}

export interface RowProcessorOptions {
  skipEmptyRows?: boolean;
  trimValues?: boolean;
  strictValidation?: boolean;
}

/**
 * Define validation schemas for each entity.
 */
const ENTITY_SCHEMAS: Record<ImportEntity, z.ZodSchema> = {
  ITEM: z.object({
    sku: z.string().min(1, "SKU is required").trim(),
    name: z.string().min(1, "Product name is required").trim(),
    description: z.string().optional().nullable(),
    category: z.string().optional().nullable(),
    unitCost: z.number().optional().nullable(),
    reorderLevel: z.number().optional().nullable(),
  }),
  SUPPLIER: z.object({
    name: z.string().min(1, "Supplier name is required").trim(),
    email: z.string().email().optional().nullable(),
    phone: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    country: z.string().optional().nullable(),
  }),
  PURCHASE_ORDER: z.object({
    poNumber: z.string().min(1, "PO number is required").trim(),
    supplierName: z.string().min(1, "Supplier name is required").trim(),
    orderDate: z.coerce.date().optional().nullable(),
    dueDate: z.coerce.date().optional().nullable(),
    totalAmount: z.number().optional().nullable(),
    notes: z.string().optional().nullable(),
  }),
  STOCK_LEVEL: z.object({
    itemSku: z.string().min(1, "Item SKU is required").trim(),
    warehouseId: z.string().min(1, "Warehouse is required").trim(),
    quantity: z.number().int().positive("Quantity must be positive"),
    type: z.string().min(1, "Movement type is required").trim().optional(),
    notes: z.string().optional().nullable(),
  }),
  CATEGORY: z.object({
    name: z.string().min(1, "Category name is required").trim(),
    description: z.string().optional().nullable(),
  }),
  WAREHOUSE: z.object({
    name: z.string().min(1, "Warehouse name is required").trim(),
    address: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    country: z.string().optional().nullable(),
  }),
  CUSTOMER: z.object({
    name: z.string().min(1, "Customer name is required").trim(),
    email: z.string().email().optional().nullable(),
    phone: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    country: z.string().optional().nullable(),
  }),
};

/**
 * Process rows with validation and transformation.
 */
export class RowProcessor {
  private schema: z.ZodSchema;
  private mappings: FieldMapping[];
  private options: RowProcessorOptions;

  constructor(entity: ImportEntity, mappings: FieldMapping[], options: RowProcessorOptions = {}) {
    this.schema = ENTITY_SCHEMAS[entity];
    this.mappings = mappings;
    this.options = {
      skipEmptyRows: true,
      trimValues: true,
      strictValidation: false,
      ...options,
    };
  }

  /**
   * Process a single row.
   */
  processRow(row: (string | null)[], rowIndex: number): ValidatedRow {
    const result: ValidatedRow = {
      rowIndex,
      data: {},
      valid: true,
      errors: [],
    };

    // Check if row is empty
    if (this.options.skipEmptyRows) {
      const isEmpty = row.every((cell) => !cell || cell.trim() === "");
      if (isEmpty) {
        return { ...result, data: {}, valid: false };
      }
    }

    // Extract fields based on mappings
    for (const mapping of this.mappings) {
      let value = row[mapping.columnIndex] ?? null;

      // Trim if enabled
      if (this.options.trimValues && typeof value === "string") {
        value = value.trim();
      }

      // Coerce to appropriate type
      try {
        const coercedValue = this.coerceValue(value, mapping.type);
        result.data[mapping.targetField] = coercedValue;
      } catch (error) {
        result.valid = false;
        result.errors.push({
          rowIndex,
          field: mapping.targetField,
          columnIndex: mapping.columnIndex,
          value,
          error: error instanceof Error ? error.message : "Type coercion failed",
        });
      }
    }

    // Validate with schema
    if (result.valid || !this.options.strictValidation) {
      const validationResult = this.schema.safeParse(result.data);

      if (!validationResult.success) {
        result.valid = false;

        for (const issue of validationResult.error.issues) {
          const field = String(issue.path[0]);
          const mapping = this.mappings.find((m) => m.targetField === field);

          result.errors.push({
            rowIndex,
            field,
            columnIndex: mapping?.columnIndex ?? -1,
            value: result.data[field] as string | null,
            error: issue.message,
          });
        }
      }
    }

    return result;
  }

  /**
   * Process multiple rows.
   */
  processRows(
    rows: (string | null)[][],
    startIndex = 0,
  ): {
    valid: ValidatedRow[];
    invalid: ValidatedRow[];
    totalErrors: number;
  } {
    const valid: ValidatedRow[] = [];
    const invalid: ValidatedRow[] = [];
    let totalErrors = 0;

    for (let i = 0; i < rows.length; i++) {
      const result = this.processRow(rows[i]!, startIndex + i + 1);

      if (result.valid) {
        valid.push(result);
      } else {
        invalid.push(result);
        totalErrors += result.errors.length;
      }
    }

    return { valid, invalid, totalErrors };
  }

  /**
   * Coerce a value to the target type.
   */
  private coerceValue(value: string | null, type: string): unknown {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    switch (type) {
      case "string":
        return String(value).trim();

      case "number": {
        const num = Number(value);
        if (Number.isNaN(num)) {
          throw new Error(`"${value}" is not a valid number`);
        }
        return num;
      }

      case "boolean": {
        const lower = String(value).toLowerCase();
        if (["true", "yes", "1", "on"].includes(lower)) {
          return true;
        }
        if (["false", "no", "0", "off"].includes(lower)) {
          return false;
        }
        throw new Error(`"${value}" is not a valid boolean`);
      }

      case "date": {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
          throw new Error(`"${value}" is not a valid date`);
        }
        return date;
      }

      case "email": {
        const email = String(value).trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          throw new Error(`"${value}" is not a valid email address`);
        }
        return email;
      }

      default:
        return value;
    }
  }

  /**
   * Get summary statistics.
   */
  getSummaryStats(results: ValidatedRow[]): {
    total: number;
    valid: number;
    invalid: number;
    errorCount: number;
    successRate: number;
  } {
    const total = results.length;
    const valid = results.filter((r) => r.valid).length;
    const invalid = total - valid;
    const errorCount = results.reduce((sum, r) => sum + r.errors.length, 0);

    return {
      total,
      valid,
      invalid,
      errorCount,
      successRate: total > 0 ? (valid / total) * 100 : 0,
    };
  }
}

export default RowProcessor;
