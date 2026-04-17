/**
 * Phase 11.1 — Transfer wizard validation schemas.
 *
 * Extracted from the server action so the schemas can be imported by
 * both the action (server-only) and pure-function tests (no db/env
 * dependency). Mirrors the pattern in src/lib/validation/movement.ts.
 */

import { z } from "zod";

/**
 * A single line in the transfer wizard — one item + quantity.
 */
export const transferLineSchema = z.object({
  itemId: z.string().trim().min(1, { message: "Item is required" }).max(64),
  quantity: z
    .number()
    .int({ message: "Quantity must be a whole number" })
    .min(1, { message: "Quantity must be at least 1" })
    .max(1_000_000, { message: "Quantity is too large" }),
});

export type TransferLine = z.infer<typeof transferLineSchema>;

/**
 * Full multi-line transfer wizard input.
 *
 * Cross-field rules enforced via superRefine:
 *   - source ≠ destination warehouse
 *   - no duplicate itemIds across lines
 */
export const createTransferInputSchema = z
  .object({
    fromWarehouseId: z.string().trim().min(1, { message: "Source location is required" }).max(64),
    toWarehouseId: z
      .string()
      .trim()
      .min(1, { message: "Destination location is required" })
      .max(64),
    lines: z.array(transferLineSchema).min(1, { message: "At least one item is required" }),
    reference: z
      .string()
      .trim()
      .max(120)
      .optional()
      .transform((v) => (v === "" || v === undefined ? null : v)),
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
        message: "Destination must be different from the source location",
      });
    }
    // Duplicate items in the same transfer
    const seen = new Set<string>();
    for (let i = 0; i < data.lines.length; i++) {
      const id = data.lines[i]?.itemId;
      if (!id) continue;
      if (seen.has(id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["lines", i, "itemId"],
          message: "This item appears more than once — combine the quantities instead",
        });
      }
      seen.add(id);
    }
  });

export type CreateTransferInput = z.infer<typeof createTransferInputSchema>;
