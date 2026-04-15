import { z } from "zod";

// Sales Orders: DRAFT → CONFIRMED → ALLOCATED → PARTIALLY_SHIPPED → SHIPPED | CANCELLED

export const salesOrderStatusEnum = z.enum([
  "DRAFT",
  "CONFIRMED",
  "ALLOCATED",
  "PARTIALLY_SHIPPED",
  "SHIPPED",
  "CANCELLED",
]);
export type SalesOrderStatusInput = z.infer<typeof salesOrderStatusEnum>;

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

export const createSalesOrderSchema = z.object({
  orderNumber: z
    .string()
    .trim()
    .max(32, { message: "Order number must be 32 characters or fewer" })
    .optional()
    .nullable()
    .transform((v) => {
      if (v === "" || v === undefined || v === null) return null;
      return v.toUpperCase();
    }),
  customerName: z
    .string()
    .trim()
    .max(255, { message: "Customer name must be 255 characters or fewer" })
    .optional()
    .nullable()
    .transform((v) => (v === "" || v === undefined || v === null ? null : v)),
  customerRef: z
    .string()
    .trim()
    .max(255, { message: "Customer ref must be 255 characters or fewer" })
    .optional()
    .nullable()
    .transform((v) => (v === "" || v === undefined || v === null ? null : v)),
  requiredDate: optionalDate,
  note: z
    .string()
    .trim()
    .max(2000, { message: "Note must be 2000 characters or fewer" })
    .optional()
    .nullable()
    .transform((v) => (v === "" || v === undefined || v === null ? null : v)),
});

export type CreateSalesOrderInput = z.input<typeof createSalesOrderSchema>;
export type CreateSalesOrderOutput = z.output<typeof createSalesOrderSchema>;

export const addSalesOrderLineSchema = z.object({
  salesOrderId: z.string().trim().min(1, { message: "Sales order ID is required" }),
  itemId: z.string().trim().min(1, { message: "Item is required" }),
  variantId: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v === "" || v === undefined || v === null ? null : v)),
  warehouseId: z.string().trim().min(1, { message: "Warehouse is required" }),
  orderedQty: positiveIntQty,
  note: z
    .string()
    .trim()
    .max(500, { message: "Note must be 500 characters or fewer" })
    .optional()
    .nullable()
    .transform((v) => (v === "" || v === undefined || v === null ? null : v)),
});

export type AddSalesOrderLineInput = z.input<typeof addSalesOrderLineSchema>;
export type AddSalesOrderLineOutput = z.output<typeof addSalesOrderLineSchema>;

export const allocateSalesOrderSchema = z.object({
  salesOrderId: z.string().trim().min(1, { message: "Sales order ID is required" }),
});

export type AllocateSalesOrderInput = z.input<typeof allocateSalesOrderSchema>;
export type AllocateSalesOrderOutput = z.output<typeof allocateSalesOrderSchema>;

export const shipSalesOrderLineSchema = z.object({
  lineId: z.string().trim().min(1, { message: "Line ID is required" }),
  shippedQty: positiveIntQty,
});

export const shipSalesOrderSchema = z.object({
  salesOrderId: z.string().trim().min(1, { message: "Sales order ID is required" }),
  lines: z
    .array(shipSalesOrderLineSchema)
    .min(1, { message: "At least one line must be shipped" }),
});

export type ShipSalesOrderInput = z.input<typeof shipSalesOrderSchema>;
export type ShipSalesOrderOutput = z.output<typeof shipSalesOrderSchema>;

export const cancelSalesOrderSchema = z.object({
  salesOrderId: z.string().trim().min(1, { message: "Sales order ID is required" }),
  reason: z
    .string()
    .trim()
    .max(500, { message: "Reason must be 500 characters or fewer" })
    .optional()
    .nullable()
    .transform((v) => (v === "" || v === undefined || v === null ? null : v)),
});

export type CancelSalesOrderInput = z.input<typeof cancelSalesOrderSchema>;
export type CancelSalesOrderOutput = z.output<typeof cancelSalesOrderSchema>;
