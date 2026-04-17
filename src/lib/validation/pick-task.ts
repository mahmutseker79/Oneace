import { z } from "zod";

// Pick Tasks: PENDING → ASSIGNED → IN_PROGRESS → PICKED → VERIFIED

export const pickTaskStatusEnum = z.enum([
  "PENDING",
  "ASSIGNED",
  "IN_PROGRESS",
  "PICKED",
  "VERIFIED",
  "CANCELLED",
]);
export type PickTaskStatusInput = z.infer<typeof pickTaskStatusEnum>;

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

export const createPickTaskSchema = z.object({
  itemId: z.string().trim().min(1, { message: "Item is required" }),
  variantId: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v === "" || v === undefined || v === null ? null : v)),
  warehouseId: z.string().trim().min(1, { message: "Warehouse is required" }),
  fromBinId: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v === "" || v === undefined || v === null ? null : v)),
  quantity: positiveIntQty,
  salesOrderLineId: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v === "" || v === undefined || v === null ? null : v)),
  note: z
    .string()
    .trim()
    .max(500, { message: "Note must be 500 characters or fewer" })
    .optional()
    .nullable()
    .transform((v) => (v === "" || v === undefined || v === null ? null : v)),
});

export type CreatePickTaskInput = z.input<typeof createPickTaskSchema>;
export type CreatePickTaskOutput = z.output<typeof createPickTaskSchema>;

export const assignPickTaskSchema = z.object({
  taskId: z.string().trim().min(1, { message: "Task ID is required" }),
  assignedToUserId: z.string().trim().min(1, { message: "User is required" }),
});

export type AssignPickTaskInput = z.input<typeof assignPickTaskSchema>;
export type AssignPickTaskOutput = z.output<typeof assignPickTaskSchema>;

export const completePickTaskSchema = z.object({
  taskId: z.string().trim().min(1, { message: "Task ID is required" }),
});

export type CompletePickTaskInput = z.input<typeof completePickTaskSchema>;
export type CompletePickTaskOutput = z.output<typeof completePickTaskSchema>;
