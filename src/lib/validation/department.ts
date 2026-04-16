import { z } from "zod";

/**
 * Validation schemas for department management.
 */

const requiredId = (message = "Required") => z.string().min(1, { message });
const optionalId = z
  .string()
  .optional()
  .transform((value) => (value === "" || value === undefined ? null : value));

const trimmedString = (min: number, max: number, message: string) =>
  z.string().trim().min(min, { message }).max(max, { message: "Too long" });

const optionalColor = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/)
  .optional()
  .transform((value) => (value === "" || value === undefined ? null : value));

/**
 * Create a department with name, optional code, color, manager, and warehouse.
 */
export const createDepartmentSchema = z.object({
  name: trimmedString(1, 120, "Department name is required"),
  code: z
    .string()
    .trim()
    .max(50, { message: "Code too long" })
    .optional()
    .transform((value) => (value === "" || value === undefined ? null : value)),
  color: optionalColor,
  managerId: optionalId,
  warehouseId: optionalId,
});

/**
 * Update department fields (all optional).
 */
export const updateDepartmentSchema = z.object({
  id: requiredId("Department ID required"),
  name: trimmedString(1, 120, "Department name is required").optional(),
  code: z
    .string()
    .trim()
    .max(50, { message: "Code too long" })
    .optional()
    .transform((value) => (value === "" || value === undefined ? null : value)),
  color: optionalColor,
  managerId: optionalId,
  warehouseId: optionalId,
  isActive: z.boolean().optional(),
});

/**
 * Delete department by ID.
 */
export const deleteDepartmentSchema = z.object({
  id: requiredId("Department ID required"),
});
