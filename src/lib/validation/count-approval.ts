import { z } from "zod";

/**
 * Validation schemas for approval workflow (submit, approve, reject).
 */

const requiredId = (message = "Required") => z.string().min(1, { message });

const optionalNote = z
  .string()
  .trim()
  .max(1000)
  .optional()
  .transform((value) => (value === "" || value === undefined ? null : value));

/**
 * Submit a count for approval. Transitions from IN_PROGRESS to PENDING_APPROVAL.
 */
export const submitForApprovalSchema = z.object({
  countId: requiredId("Count ID required"),
  comment: optionalNote,
});

/**
 * Approve a pending count. Transitions from PENDING_APPROVAL to APPROVED.
 */
export const approveCountSchema = z.object({
  countId: requiredId("Count ID required"),
  comment: optionalNote,
});

/**
 * Reject a pending count. Transitions from PENDING_APPROVAL back to IN_PROGRESS.
 */
export const rejectCountSchema = z.object({
  countId: requiredId("Count ID required"),
  comment: z
    .string()
    .trim()
    .min(1, { message: "Rejection reason required" })
    .max(1000, { message: "Comment too long" }),
});

/**
 * Rollback a completed count.
 */
export const rollbackCountSchema = z.object({
  countId: requiredId("Count ID required"),
  reason: z
    .string()
    .trim()
    .min(1, { message: "Rollback reason required" })
    .max(1000, { message: "Reason too long" }),
});
