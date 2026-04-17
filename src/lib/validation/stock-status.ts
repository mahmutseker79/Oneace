import { z } from "zod";

/**
 * Validation schemas for stock status changes.
 * Used when changing stock status (e.g., AVAILABLE -> DAMAGED, IN_STOCK -> RESERVED).
 */

export const stockStatusEnum = z.enum([
  "AVAILABLE",
  "RESERVED",
  "DAMAGED",
  "EXPIRED",
  "QUARANTINE",
]);
export type StockStatus = z.infer<typeof stockStatusEnum>;

const requiredId = (message = "Required") => z.string().min(1, { message });
const optionalId = z
  .string()
  .optional()
  .transform((value) => (value === "" || value === undefined ? null : value));

const _trimmedString = (min: number, max: number, message: string) =>
  z.string().trim().min(min, { message }).max(max, { message: "Too long" });

const nonNegativeInt = z
  .union([z.string(), z.number()])
  .transform((value) => {
    if (value === "" || value === undefined || value === null) return Number.NaN;
    const n = typeof value === "number" ? value : Number(value);
    return Number.isNaN(n) ? Number.NaN : Math.trunc(n);
  })
  .pipe(
    z
      .number()
      .int({ message: "Must be a whole number" })
      .min(0, { message: "Cannot be negative" })
      .max(1_000_000, { message: "Value is too large" }),
  );

const optionalNote = z
  .string()
  .trim()
  .max(1000)
  .optional()
  .transform((value) => (value === "" || value === undefined ? null : value));

/**
 * Change stock status for a quantity of items.
 * Requires: itemId, warehouseId, fromStatus, toStatus, quantity, reasonCodeId
 * Optional: binId, note
 */
export const changeStockStatusSchema = z.object({
  itemId: requiredId("Select an item"),
  warehouseId: requiredId("Select a warehouse"),
  binId: optionalId,
  fromStatus: stockStatusEnum,
  toStatus: stockStatusEnum,
  quantity: nonNegativeInt,
  reasonCodeId: requiredId("Select a reason code"),
  note: optionalNote,
});
export type ChangeStockStatusInput = z.infer<typeof changeStockStatusSchema>;
