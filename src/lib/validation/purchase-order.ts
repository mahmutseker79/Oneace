import { z } from "zod";

// Purchase Orders. A PO has a header (supplier, warehouse, currency, dates,
// status) and an ordered list of line items referencing an Item. Receipt
// flow happens server-side via receivePurchaseOrderAction — the schema here
// only covers create/update, not receive.

export const purchaseOrderStatusEnum = z.enum([
  "DRAFT",
  "SENT",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "CANCELLED",
]);
export type PurchaseOrderStatusInput = z.infer<typeof purchaseOrderStatusEnum>;

// Decimal-ish input: accept "", null, undefined, number, or string. Returns
// `null` on empty, otherwise a non-negative number. Used for per-line
// unitCost overrides — null means "use item.costPrice as a default".
const optionalMoney = z
  .union([z.string(), z.number(), z.undefined(), z.null()])
  .transform((v) => {
    if (v === undefined || v === null || v === "") return null;
    const cleaned = typeof v === "string" ? v.replace(/,/g, "").trim() : v;
    const n = typeof cleaned === "number" ? cleaned : Number(cleaned);
    return Number.isFinite(n) ? n : null;
  })
  .pipe(
    z
      .number()
      .nullable()
      .refine((n) => n === null || n >= 0, { message: "Amount cannot be negative" })
      .refine((n) => n === null || n <= 99_999_999.99, { message: "Amount is too large" }),
  );

// Integer quantity: accepts string/number, rejects NaN/negative.
const positiveIntQty = z
  .union([z.string(), z.number()])
  .transform((v) => {
    if (v === "" || v === undefined || v === null) return Number.NaN;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : Number.NaN;
  })
  .pipe(
    z
      .number()
      .int({ message: "Quantity must be a whole number" })
      .min(1, { message: "Quantity must be at least 1" })
      .max(1_000_000, { message: "Quantity is too large" }),
  );

// Optional ISO date string (yyyy-mm-dd from <input type="date">) or empty.
const optionalDate = z
  .union([z.string(), z.date(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === undefined || v === null || v === "") return null;
    if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  })
  .pipe(z.date().nullable());

export const purchaseOrderLineInputSchema = z.object({
  itemId: z.string().trim().min(1, { message: "Item is required" }),
  quantity: positiveIntQty,
  unitCost: optionalMoney,
  notes: z
    .string()
    .trim()
    .max(500)
    .optional()
    .nullable()
    .transform((v) => (v === "" || v === undefined || v === null ? null : v)),
});

export type PurchaseOrderLineInput = z.input<typeof purchaseOrderLineInputSchema>;
export type PurchaseOrderLineOutput = z.output<typeof purchaseOrderLineInputSchema>;

export const purchaseOrderInputSchema = z.object({
  poNumber: z
    .string()
    .trim()
    .max(32, { message: "PO number must be 32 characters or fewer" })
    .regex(/^[A-Z0-9_\-/]*$/i, {
      message: "PO number can only contain letters, numbers, dashes, slashes, underscores",
    })
    .optional()
    .nullable()
    .transform((v) => {
      if (v === "" || v === undefined || v === null) return null;
      return v.toUpperCase();
    }),
  supplierId: z.string().trim().min(1, { message: "Supplier is required" }),
  warehouseId: z.string().trim().min(1, { message: "Destination warehouse is required" }),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .length(3, { message: "Currency must be a 3-letter ISO code" })
    .regex(/^[A-Z]{3}$/, { message: "Currency must be uppercase ISO 4217" })
    .default("USD"),
  orderDate: optionalDate,
  expectedDate: optionalDate,
  notes: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .nullable()
    .transform((v) => (v === "" || v === undefined || v === null ? null : v)),
  status: purchaseOrderStatusEnum.default("DRAFT"),
  lines: z
    .array(purchaseOrderLineInputSchema)
    .min(1, { message: "At least one line item is required" })
    .max(1000, { message: "A PO can have at most 1000 lines" }),
});

export type PurchaseOrderInput = z.input<typeof purchaseOrderInputSchema>;
export type PurchaseOrderOutput = z.output<typeof purchaseOrderInputSchema>;

// Receive-only schema: takes a list of received deltas keyed by line id.
// Enforces non-negative deltas. The server action validates against the
// remaining open quantity on each line.
export const receivePurchaseOrderSchema = z.object({
  purchaseOrderId: z.string().trim().min(1),
  receipts: z
    .array(
      z.object({
        lineId: z.string().trim().min(1),
        quantity: z
          .union([z.string(), z.number()])
          .transform((v) => {
            if (v === "" || v === undefined || v === null) return 0;
            const n = typeof v === "number" ? v : Number(v);
            return Number.isFinite(n) ? Math.trunc(n) : Number.NaN;
          })
          .pipe(
            z
              .number()
              .int({ message: "Receipt qty must be a whole number" })
              .min(0, { message: "Receipt qty cannot be negative" })
              .max(1_000_000, { message: "Receipt qty is too large" }),
          ),
      }),
    )
    .min(1, { message: "At least one line receipt is required" }),
  notes: z
    .string()
    .trim()
    .max(500)
    .optional()
    .nullable()
    .transform((v) => (v === "" || v === undefined || v === null ? null : v)),
  // Phase 6C — stable per-form-mount nonce from the client. The
  // server action derives per-line idempotency keys from this and
  // short-circuits the transaction on replay. Optional so legacy
  // clients / automated callers keep working on the fallback path.
  submissionNonce: z
    .string()
    .trim()
    .max(128)
    .optional()
    .nullable()
    .transform((v) => (v === "" || v === undefined || v === null ? null : v)),
});

export type ReceivePurchaseOrderInput = z.input<typeof receivePurchaseOrderSchema>;
export type ReceivePurchaseOrderOutput = z.output<typeof receivePurchaseOrderSchema>;
