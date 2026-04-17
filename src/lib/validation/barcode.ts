import { z } from "zod";

/**
 * Barcode validation schema.
 * Validates location barcode values for warehouses and bins.
 */
export const barcodeValueSchema = z
  .string()
  .trim()
  .min(1, { message: "Barcode value is required" })
  .max(256, { message: "Barcode value must be 256 characters or fewer" })
  .regex(/^[A-Z0-9_-]+$/i, {
    message: "Barcode can only contain letters, numbers, dashes, and underscores",
  })
  .transform((value) => value.toUpperCase());

/**
 * Generate a unique barcode value for a location (warehouse or bin).
 *
 * Format: LOC-{type}-{code}-{timestamp}
 * Example: LOC-WAREHOUSE-WH01-1713177600000
 *
 * @param type - The location type: "warehouse" or "bin"
 * @param code - The location code (warehouse code or bin code)
 * @returns The generated barcode value
 */
export function generateLocationBarcode(type: "warehouse" | "bin", code: string): string {
  const timestamp = Date.now();
  const typeUpper = type.toUpperCase();
  const codeUpper = code.toUpperCase();
  return `LOC-${typeUpper}-${codeUpper}-${timestamp}`;
}

/**
 * Validate a barcode value. Returns true if valid, false otherwise.
 */
export function isValidBarcodeValue(value: string): boolean {
  const result = barcodeValueSchema.safeParse(value);
  return result.success;
}

export type BarcodeValueInput = z.input<typeof barcodeValueSchema>;
export type BarcodeValueOutput = z.output<typeof barcodeValueSchema>;
