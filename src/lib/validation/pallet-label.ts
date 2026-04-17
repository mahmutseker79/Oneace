import { z } from "zod";

const optionalString = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((value) => (value === "" || value === undefined ? null : value));

const positiveInt = z
  .union([z.string(), z.number()])
  .transform((value) => {
    if (value === "" || value === undefined || value === null) return 1;
    const n = typeof value === "number" ? value : Number(value);
    return Number.isNaN(n) ? 1 : Math.max(1, Math.trunc(n));
  })
  .pipe(
    z
      .number()
      .int()
      .min(1, { message: "Quantity must be at least 1" })
      .max(1_000_000, { message: "Quantity is too large" }),
  );

/**
 * Zod schema for creating a new pallet barcode label.
 * Captures the pallet details, items, warehouse, and barcode.
 */
export const createPalletLabelSchema = z.object({
  itemIds: z
    .array(z.string().trim().min(1))
    .min(1, { message: "At least one item is required" })
    .max(1000, { message: "Too many items" }),
  warehouseId: z.string().trim().min(1, { message: "Warehouse is required" }),
  binId: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value === "" || value === undefined ? null : value)),
  notes: optionalString,
  quantity: positiveInt,
  barcodeValue: z
    .string()
    .trim()
    .max(64)
    .optional()
    .transform((value) => (value === "" || value === undefined ? null : value)),
});

export type CreatePalletLabelInput = z.infer<typeof createPalletLabelSchema>;

/**
 * Zod schema for updating a pallet barcode label.
 */
export const updatePalletLabelSchema = z.object({
  notes: optionalString,
  quantity: positiveInt,
});

export type UpdatePalletLabelInput = z.infer<typeof updatePalletLabelSchema>;
