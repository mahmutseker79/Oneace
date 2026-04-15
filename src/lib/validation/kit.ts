import { z } from "zod";

// Kits: Bundle/Kit/Assembly definitions and operations

export const kitTypeEnum = z.enum(["BUNDLE", "KIT", "ASSEMBLY"]);
export type KitType = z.infer<typeof kitTypeEnum>;

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

export const createKitSchema = z.object({
  parentItemId: z.string().trim().min(1, { message: "Parent item is required" }),
  name: z
    .string()
    .trim()
    .min(1, { message: "Kit name is required" })
    .max(255, { message: "Kit name must be 255 characters or fewer" }),
  description: z
    .string()
    .trim()
    .max(2000, { message: "Description must be 2000 characters or fewer" })
    .optional()
    .nullable()
    .transform((v) => (v === "" || v === undefined || v === null ? null : v)),
  type: kitTypeEnum.default("KIT"),
});

export type CreateKitInput = z.input<typeof createKitSchema>;
export type CreateKitOutput = z.output<typeof createKitSchema>;

export const addKitComponentSchema = z.object({
  kitId: z.string().trim().min(1, { message: "Kit ID is required" }),
  componentItemId: z.string().trim().min(1, { message: "Component item is required" }),
  variantId: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v === "" || v === undefined || v === null ? null : v)),
  quantity: positiveIntQty,
});

export type AddKitComponentInput = z.input<typeof addKitComponentSchema>;
export type AddKitComponentOutput = z.output<typeof addKitComponentSchema>;

export const assembleKitSchema = z.object({
  kitId: z.string().trim().min(1, { message: "Kit ID is required" }),
  warehouseId: z.string().trim().min(1, { message: "Warehouse is required" }),
  quantity: positiveIntQty,
  note: z
    .string()
    .trim()
    .max(500, { message: "Note must be 500 characters or fewer" })
    .optional()
    .nullable()
    .transform((v) => (v === "" || v === undefined || v === null ? null : v)),
});

export type AssembleKitInput = z.input<typeof assembleKitSchema>;
export type AssembleKitOutput = z.output<typeof assembleKitSchema>;

export const disassembleKitSchema = z.object({
  kitId: z.string().trim().min(1, { message: "Kit ID is required" }),
  warehouseId: z.string().trim().min(1, { message: "Warehouse is required" }),
  quantity: positiveIntQty,
  note: z
    .string()
    .trim()
    .max(500, { message: "Note must be 500 characters or fewer" })
    .optional()
    .nullable()
    .transform((v) => (v === "" || v === undefined || v === null ? null : v)),
});

export type DisassembleKitInput = z.input<typeof disassembleKitSchema>;
export type DisassembleKitOutput = z.output<typeof disassembleKitSchema>;
