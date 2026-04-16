import { z } from "zod";

/**
 * Phase L9 — Organization settings schema for validation.
 *
 * Used by updateOrgSettingsAction to validate org-level configuration
 * (numbering prefixes, counting workflow defaults, stock management rules,
 * display preferences).
 *
 * All fields are optional so the UI can update sections independently
 * or submit a full form — any present field is upserted, absent ones are
 * left untouched.
 */

export const updateOrgSettingsSchema = z.object({
  transferNumberPrefix: z
    .string()
    .min(1, "Transfer prefix must be at least 1 character")
    .max(10, "Transfer prefix must be at most 10 characters")
    .regex(/^[A-Z0-9_-]+$/, "Transfer prefix must be uppercase alphanumeric, underscore, or hyphen")
    .optional(),

  salesOrderPrefix: z
    .string()
    .min(1, "Sales order prefix must be at least 1 character")
    .max(10, "Sales order prefix must be at most 10 characters")
    .regex(
      /^[A-Z0-9_-]+$/,
      "Sales order prefix must be uppercase alphanumeric, underscore, or hyphen",
    )
    .optional(),

  assetTagPrefix: z
    .string()
    .min(1, "Asset tag prefix must be at least 1 character")
    .max(10, "Asset tag prefix must be at most 10 characters")
    .regex(
      /^[A-Z0-9_-]+$/,
      "Asset tag prefix must be uppercase alphanumeric, underscore, or hyphen",
    )
    .optional(),

  batchNumberPrefix: z
    .string()
    .min(1, "Batch prefix must be at least 1 character")
    .max(10, "Batch prefix must be at most 10 characters")
    .regex(/^[A-Z0-9_-]+$/, "Batch prefix must be uppercase alphanumeric, underscore, or hyphen")
    .optional(),

  requireCountApproval: z.boolean().optional(),

  varianceThreshold: z
    .number()
    .min(0, "Variance threshold must be 0 or greater")
    .max(100, "Variance threshold must be 100 or less")
    .optional(),

  recountOnThreshold: z.boolean().optional(),

  defaultCountMethodology: z
    .enum(["CYCLE", "FULL", "SPOT", "BLIND", "DOUBLE_BLIND", "DIRECTED", "PARTIAL"])
    .optional(),

  allowNegativeStock: z.boolean().optional(),

  defaultStockStatus: z
    .enum(["AVAILABLE", "HOLD", "DAMAGED", "QUARANTINE", "EXPIRED", "IN_TRANSIT", "RESERVED"])
    .optional(),

  dateFormat: z.enum(["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"]).optional(),

  currencySymbol: z
    .string()
    .min(1, "Currency symbol must be at least 1 character")
    .max(5, "Currency symbol must be at most 5 characters")
    .optional(),
});

export type UpdateOrgSettingsInput = z.infer<typeof updateOrgSettingsSchema>;
