/**
 * Phase L4 — Stock transfer state machine and validation schemas.
 *
 * Schemas for:
 *   - createTransferSchema: header creation (warehouses + note)
 *   - addTransferLineSchema: adding individual lines to DRAFT transfers
 *   - receiveTransferLineSchema: receiving lines from IN_TRANSIT transfers
 *   - Transfer number auto-generation using OrgSettings
 */

import { z } from "zod";

/**
 * Create a new transfer header (DRAFT status).
 * At creation time, we don't add lines — those are added separately
 * via addTransferLine so the UI can iterate without batch validation.
 */
export const createTransferSchema = z
  .object({
    fromWarehouseId: z.string().trim().min(1, "Source warehouse is required").max(64),
    toWarehouseId: z.string().trim().min(1, "Destination warehouse is required").max(64),
    note: z
      .string()
      .trim()
      .max(1000)
      .optional()
      .transform((v) => (v === "" || v === undefined ? null : v)),
  })
  .superRefine((data, ctx) => {
    if (data.fromWarehouseId === data.toWarehouseId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["toWarehouseId"],
        message: "Destination warehouse must be different from source",
      });
    }
  });

export type CreateTransferInput = z.infer<typeof createTransferSchema>;

/**
 * Add a line to a transfer.
 * Validates: itemId + quantity (required), variant/batch/serial (optional).
 */
export const addTransferLineSchema = z.object({
  transferId: z.string().trim().min(1, "Transfer ID is required").max(64),
  itemId: z.string().trim().min(1, "Item is required").max(64),
  variantId: z.string().trim().max(64).optional().nullable(),
  batchId: z.string().trim().max(64).optional().nullable(),
  serialNumberId: z.string().trim().max(64).optional().nullable(),
  shippedQty: z
    .number()
    .int("Quantity must be a whole number")
    .min(1, "Quantity must be at least 1")
    .max(1_000_000, "Quantity is too large"),
});

export type AddTransferLineInput = z.infer<typeof addTransferLineSchema>;

/**
 * Receive a line item during transfer receive flow.
 * Validates: lineId + receivedQty (required), note (optional).
 */
export const receiveTransferLineSchema = z.object({
  lineId: z.string().trim().min(1, "Line ID is required").max(64),
  receivedQty: z
    .number()
    .int("Quantity must be a whole number")
    .min(0, "Quantity cannot be negative")
    .max(1_000_000, "Quantity is too large"),
  note: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
});

export type ReceiveTransferLineInput = z.infer<typeof receiveTransferLineSchema>;

/**
 * Bulk receive input — array of lines to receive with optional reason codes.
 */
export const receiveTransferSchema = z.object({
  transferId: z.string().trim().min(1, "Transfer ID is required").max(64),
  lines: z.array(receiveTransferLineSchema).min(1, "At least one line must be received"),
  note: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
});

export type ReceiveTransferInput = z.infer<typeof receiveTransferSchema>;
