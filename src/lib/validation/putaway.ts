/**
 * Phase 11.3 — Putaway validation schemas.
 *
 * Putaway moves stock from warehouse-level (binId=null) into a specific
 * bin via a BIN_TRANSFER movement with a null source bin.
 *
 * Extracted from the server action so schemas can be imported by both
 * the action (server-only) and pure-function tests (no db/env dependency).
 */

import { z } from "zod";

/**
 * A single putaway assignment: move `quantity` units of `itemId` into
 * `toBinId` from the warehouse-level pool.
 */
export const putawayLineSchema = z.object({
  itemId: z.string().trim().min(1, { message: "Item is required" }).max(64),
  toBinId: z.string().trim().min(1, { message: "Destination bin is required" }).max(64),
  quantity: z
    .number()
    .int({ message: "Quantity must be a whole number" })
    .min(1, { message: "Quantity must be at least 1" })
    .max(1_000_000, { message: "Quantity is too large" }),
});

export type PutawayLine = z.infer<typeof putawayLineSchema>;

/**
 * Full putaway submission — one or more lines for a specific warehouse.
 *
 * Cross-field rules enforced via superRefine:
 *   - No duplicate (itemId + toBinId) combinations in the same submission.
 *     Two lines for the same item going to different bins are valid.
 *     Two lines for the same item going to the same bin are not.
 */
export const putawayInputSchema = z
  .object({
    warehouseId: z.string().trim().min(1, { message: "Warehouse is required" }).max(64),
    lines: z.array(putawayLineSchema).min(1, { message: "At least one line is required" }),
  })
  .superRefine((data, ctx) => {
    const seen = new Set<string>();
    for (let i = 0; i < data.lines.length; i++) {
      const line = data.lines[i];
      if (!line) continue;
      const key = `${line.itemId}::${line.toBinId}`;
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["lines", i, "toBinId"],
          message: "Duplicate: this item is already being put into this bin in this submission.",
        });
      }
      seen.add(key);
    }
  });

export type PutawayInput = z.infer<typeof putawayInputSchema>;
