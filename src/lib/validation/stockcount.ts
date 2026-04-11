import { z } from "zod";

/**
 * Validation schemas for the stock-counting workflow.
 *
 * Four entry points, one per server action:
 *   createCountInputSchema  — scope + methodology + item selection
 *   addEntryInputSchema     — append a counted-qty row to a count
 *   cancelCountInputSchema  — terminal cancel with required reason
 *   completeCountInputSchema — reconcile + optional ledger posting
 *
 * All shapes are server-trusted AFTER multi-tenant guards in
 * src/app/(app)/stock-counts/actions.ts. Treat zod as syntax/shape
 * validation; cross-org leakage is stopped in the action, not here.
 */

export const countMethodologyEnum = z.enum([
  "CYCLE",
  "FULL",
  "SPOT",
  "BLIND",
  "DOUBLE_BLIND",
  "DIRECTED",
]);
export type CountMethodology = z.infer<typeof countMethodologyEnum>;

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

const optionalCounterTag = z
  .string()
  .trim()
  .max(32)
  .optional()
  .transform((value) => (value === "" || value === undefined ? null : value));

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

/**
 * Create a count. At minimum the user picks a name, methodology, and at
 * least one item. Warehouse filter is optional — null means "all
 * warehouses the caller's org owns". itemIds caps out at 10_000 to keep
 * the snapshot insert inside Postgres's parameter budget and to force
 * the user to split absurdly large full counts into smaller batches.
 */
export const createCountInputSchema = z.object({
  name: trimmedString(1, 120, "Name is required"),
  methodology: countMethodologyEnum,
  warehouseId: optionalId,
  itemIds: z
    .array(requiredId("Invalid item id"))
    .min(1, { message: "Select at least one item" })
    .max(10_000, { message: "Too many items — split into smaller counts" }),
});
export type CreateCountInput = z.infer<typeof createCountInputSchema>;

/**
 * Add one entry to a count. Counted qty may be 0 — a counter scanning
 * an empty bin still wants to record "I looked and there were zero".
 * counterTag is the hook for double-blind mode (A vs B pass); the MVP
 * reconcile sums all entries regardless of tag.
 */
export const addEntryInputSchema = z.object({
  countId: requiredId(),
  itemId: requiredId("Select an item"),
  warehouseId: requiredId("Select a warehouse"),
  countedQuantity: nonNegativeInt,
  counterTag: optionalCounterTag,
  note: optionalNote,
});
export type AddEntryInput = z.infer<typeof addEntryInputSchema>;

/**
 * Sprint 27 — PWA Sprint 4 follow-on. Offline-op payload shape for
 * `countEntry.add`. Mirrors the movement op contract:
 *
 *   - `idempotencyKey` is a client-generated UUID v4 persisted on
 *     `CountEntry` under the compound unique
 *     `(organizationId, idempotencyKey)`. Replays from the queue can't
 *     double-count — the second insert either hits the pre-check or
 *     races into P2002, both branches return the original row's id.
 *   - `input` reuses `addEntryInputSchema` verbatim. One validator,
 *     one source of truth for what a valid count entry looks like.
 *
 * The stock-count multi-row session is OneAce's Flutter moat — a
 * warehouse counter scanning bins on a phone with flaky reception
 * should never lose an entry just because the cell tower blinked.
 */
export const countEntryOpPayloadSchema = z.object({
  idempotencyKey: z.string().uuid({ message: "idempotencyKey must be a UUID" }),
  input: addEntryInputSchema,
});
export type CountEntryOpPayload = z.infer<typeof countEntryOpPayloadSchema>;

/**
 * Cancelling a count is terminal and requires an explicit reason so
 * auditors can see why expected-qty snapshots were abandoned.
 */
export const cancelCountInputSchema = z.object({
  countId: requiredId(),
  reason: trimmedString(3, 500, "Please provide a reason"),
});
export type CancelCountInput = z.infer<typeof cancelCountInputSchema>;

/**
 * Complete (reconcile) a count. When applyAdjustments is true the
 * server posts ADJUSTMENT movements for every non-zero variance inside
 * the same transaction as the state change, so the ledger and the
 * count audit trail cannot diverge.
 */
export const completeCountInputSchema = z.object({
  countId: requiredId(),
  applyAdjustments: z.boolean(),
});
export type CompleteCountInput = z.infer<typeof completeCountInputSchema>;
