import { z } from "zod";

/**
 * Stock movement validation.
 *
 * MVP supports four types (COUNT lands in Sprint 3):
 *   RECEIPT    — goods in, quantity > 0, +direction (direction is fixed)
 *   ISSUE      — goods out, quantity > 0, -direction (fixed)
 *   ADJUSTMENT — manual correction, quantity > 0, direction in {+1, -1}
 *   TRANSFER   — between warehouses, quantity > 0, both sides fixed
 *
 * The server action consumes this schema, then derives the signed delta
 * applied to StockLevel from (type, direction). See
 * src/app/(app)/movements/actions.ts.
 */

export const movementTypeEnum = z.enum(["RECEIPT", "ISSUE", "ADJUSTMENT", "TRANSFER"]);
export type MovementTypeInput = z.infer<typeof movementTypeEnum>;

const optionalString = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value === "" || value === undefined ? null : value));

const positiveInt = z
  .union([z.string(), z.number()])
  .transform((value) => {
    if (value === "" || value === undefined || value === null) return Number.NaN;
    const n = typeof value === "number" ? value : Number(value);
    return Number.isNaN(n) ? Number.NaN : Math.trunc(n);
  })
  .pipe(
    z
      .number()
      .int({ message: "Quantity must be a whole number" })
      .min(1, { message: "Quantity must be at least 1" })
      .max(1_000_000, { message: "Quantity is too large" }),
  );

const requiredId = (message: string) => z.string().trim().min(1, { message }).max(64);

const adjustmentDirection = z
  .union([z.string(), z.number()])
  .transform((value) => {
    if (value === undefined || value === null || value === "") return 1;
    const n = typeof value === "number" ? value : Number(value);
    return n < 0 ? -1 : 1;
  })
  .pipe(
    z
      .number()
      .int()
      .refine((n) => n === 1 || n === -1),
  );

const baseShape = {
  itemId: requiredId("Item is required"),
  warehouseId: requiredId("Warehouse is required"),
  quantity: positiveInt,
  reference: optionalString(120),
  note: optionalString(1000),
};

/**
 * Discriminated union so each movement type carries exactly the fields
 * it needs. TypeScript + Zod both enforce this at parse time.
 *
 * Cross-field validation (e.g. TRANSFER source ≠ destination) is applied
 * with a top-level `.superRefine` rather than wrapping individual union
 * members with `.refine`, because a `ZodEffects` wrapper breaks the
 * `discriminatedUnion` signature in Zod 3.x.
 */
export const movementInputSchema = z
  .discriminatedUnion("type", [
    z.object({
      type: z.literal("RECEIPT"),
      ...baseShape,
    }),
    z.object({
      type: z.literal("ISSUE"),
      ...baseShape,
    }),
    z.object({
      type: z.literal("ADJUSTMENT"),
      ...baseShape,
      direction: adjustmentDirection,
    }),
    z.object({
      type: z.literal("TRANSFER"),
      ...baseShape,
      toWarehouseId: requiredId("Destination warehouse is required"),
    }),
  ])
  .superRefine((data, ctx) => {
    if (data.type === "TRANSFER" && data.toWarehouseId === data.warehouseId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["toWarehouseId"],
        message: "Destination must be different from the source warehouse",
      });
    }
  });

export type MovementInput = z.infer<typeof movementInputSchema>;

/**
 * Sprint 26 — PWA Sprint 4 Part B. Offline-op payload shape.
 *
 * The offline queue dispatches the `movement.create` opType with this
 * exact JSON payload. The server action validates both halves:
 *
 *   - `idempotencyKey` is a client-generated UUID stored on the
 *     StockMovement row via a compound unique constraint
 *     `(organizationId, idempotencyKey)`. Replays from the queue can't
 *     double-apply — the second insert violates the constraint and the
 *     handler returns the existing row's id.
 *   - `input` is the full discriminated-union movement shape, reused
 *     verbatim from the online fast path. One validator, one source of
 *     truth for what a valid movement looks like.
 *
 * UUID v4 shape (36 chars, four hyphens, lowercase hex) is enforced so a
 * random string from a tampered client can't silently pollute the
 * idempotency index. `crypto.randomUUID()` in modern browsers always
 * produces v4.
 */
export const movementOpPayloadSchema = z.object({
  idempotencyKey: z.string().uuid({ message: "idempotencyKey must be a UUID" }),
  input: movementInputSchema,
});

export type MovementOpPayload = z.infer<typeof movementOpPayloadSchema>;

/**
 * Given a parsed movement input, compute the signed delta that must be
 * applied to the source StockLevel row. For TRANSFER this only covers the
 * source warehouse — the server action applies +quantity to the
 * destination in the same transaction.
 */
export function signedSourceDelta(input: MovementInput): number {
  if (input.type === "RECEIPT") return input.quantity;
  if (input.type === "ISSUE") return -input.quantity;
  if (input.type === "ADJUSTMENT") return input.direction * input.quantity;
  // TRANSFER (discriminated union exhaustive)
  return -input.quantity;
}

/**
 * Database column for StockMovement.direction. RECEIPT/TRANSFER default to
 * +1 for display, ISSUE to -1, ADJUSTMENT carries whatever the user chose.
 */
export function movementDirection(input: MovementInput): number {
  if (input.type === "ISSUE") return -1;
  if (input.type === "ADJUSTMENT") return input.direction;
  // RECEIPT / TRANSFER
  return 1;
}
