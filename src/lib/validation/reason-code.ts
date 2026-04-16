import { z } from "zod";

/**
 * Validation schemas for reason codes.
 * Reason codes are configurable tags applied to stock movements and variances
 * to classify their cause (e.g., "DMG/Damage", "THEFT/Theft-Shrinkage").
 */

export const reasonCategoryEnum = z.enum([
  "VARIANCE",
  "ADJUSTMENT",
  "TRANSFER",
  "RETURN",
  "DISPOSAL",
  "COUNT",
  "OTHER",
]);
export type ReasonCategory = z.infer<typeof reasonCategoryEnum>;

const trimmedString = (min: number, max: number, message: string) =>
  z.string().trim().min(min, { message }).max(max, { message: "Too long" });

const optionalDescription = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((value) => (value === "" || value === undefined ? null : value));

/**
 * Create a new reason code. Code is uppercase alphanumeric + underscore,
 * 1-20 characters. Name is 1-100 chars. Category is required.
 * Description is optional, max 500 chars.
 */
export const createReasonCodeSchema = z.object({
  code: trimmedString(1, 20, "Code is required")
    .transform((val) => val.toUpperCase())
    .refine(
      (val) => /^[A-Z0-9_]+$/.test(val),
      "Code must contain only letters, numbers, and underscores",
    ),
  name: trimmedString(1, 100, "Name is required"),
  category: reasonCategoryEnum,
  description: optionalDescription,
});
export type CreateReasonCodeInput = z.infer<typeof createReasonCodeSchema>;

/**
 * Update an existing reason code. All fields are optional.
 */
export const updateReasonCodeSchema = createReasonCodeSchema.partial();
export type UpdateReasonCodeInput = z.infer<typeof updateReasonCodeSchema>;
