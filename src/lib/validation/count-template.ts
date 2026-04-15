import { z } from "zod";

/**
 * Validation schemas for count templates (reusable count configurations).
 */

const requiredId = (message = "Required") => z.string().min(1, { message });
const optionalId = z
  .string()
  .optional()
  .transform((value) => (value === "" || value === undefined ? null : value));

const trimmedString = (min: number, max: number, message: string) =>
  z.string().trim().min(min, { message }).max(max, { message: "Too long" });

const optionalNote = z
  .string()
  .trim()
  .max(1000)
  .optional()
  .transform((value) => (value === "" || value === undefined ? null : value));

export const countMethodologyEnum = z.enum([
  "CYCLE",
  "FULL",
  "SPOT",
  "BLIND",
  "DOUBLE_BLIND",
  "DIRECTED",
]);
export type CountMethodology = z.infer<typeof countMethodologyEnum>;

export const countScopeEnum = z.enum(["FULL", "PARTIAL", "DEPARTMENT"]);
export type CountScope = z.infer<typeof countScopeEnum>;

/**
 * Create a count template.
 */
export const createTemplateSchema = z.object({
  name: trimmedString(1, 120, "Template name is required"),
  description: optionalNote,
  methodology: countMethodologyEnum,
  scope: countScopeEnum,
  departmentId: optionalId,
  warehouseId: optionalId,
  itemIds: z
    .array(requiredId("Invalid item id"))
    .min(1, { message: "Select at least one item" })
    .max(10_000, { message: "Too many items" }),
  requiresApproval: z.boolean().default(false),
  cronExpression: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((value) => (value === "" || value === undefined ? null : value)),
});
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;

/**
 * Update a count template.
 */
export const updateTemplateSchema = z.object({
  id: requiredId("Template ID required"),
  name: trimmedString(1, 120, "Template name is required").optional(),
  description: optionalNote,
  methodology: countMethodologyEnum.optional(),
  scope: countScopeEnum.optional(),
  departmentId: optionalId,
  warehouseId: optionalId,
  itemIds: z.array(requiredId("Invalid item id")).optional(),
  requiresApproval: z.boolean().optional(),
  cronExpression: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((value) => (value === "" || value === undefined ? null : value)),
});
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;

/**
 * Delete a count template.
 */
export const deleteTemplateSchema = z.object({
  id: requiredId("Template ID required"),
});
export type DeleteTemplateInput = z.infer<typeof deleteTemplateSchema>;
