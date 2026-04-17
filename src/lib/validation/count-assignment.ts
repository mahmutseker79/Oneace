import { z } from "zod";

/**
 * Validation schemas for count assignments (multi-counter workflow).
 */

const requiredId = (message = "Required") => z.string().min(1, { message });
const optionalId = z
  .string()
  .optional()
  .transform((value) => (value === "" || value === undefined ? null : value));

export const countRoleEnum = z.enum(["COUNTER", "VERIFIER", "SUPERVISOR"]);
export type CountRole = z.infer<typeof countRoleEnum>;

export const assignmentStatusEnum = z.enum(["PENDING", "ACTIVE", "COMPLETED"]);
export type AssignmentStatus = z.infer<typeof assignmentStatusEnum>;

/**
 * Create a count assignment. Assigns a user to count with optional department/warehouse scope.
 */
export const createAssignmentSchema = z.object({
  countId: requiredId("Count ID required"),
  userId: requiredId("User ID required"),
  departmentId: optionalId,
  warehouseId: optionalId,
  role: countRoleEnum.default("COUNTER"),
});

/**
 * Update assignment status or role.
 */
export const updateAssignmentSchema = z.object({
  id: requiredId("Assignment ID required"),
  role: countRoleEnum.optional(),
  status: assignmentStatusEnum.optional(),
  itemsCounted: z.number().int().min(0).optional(),
});

/**
 * Remove an assignment.
 */
export const removeAssignmentSchema = z.object({
  id: requiredId("Assignment ID required"),
});
