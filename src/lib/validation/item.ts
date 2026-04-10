import { z } from "zod";

// Accepts empty string → null, empty string → undefined, or valid value.
// Used for optional text fields from HTML form inputs.
const optionalString = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((value) => (value === "" || value === undefined ? null : value));

// Accepts "" | undefined | number string → number | null.
const optionalDecimal = z
  .union([z.string(), z.number(), z.undefined(), z.null()])
  .transform((value) => {
    if (value === undefined || value === null || value === "") return null;
    const n = typeof value === "number" ? value : Number(value);
    if (Number.isNaN(n)) return null;
    return n;
  })
  .pipe(
    z
      .number()
      .nullable()
      .refine((n) => n === null || n >= 0, {
        message: "Amount cannot be negative",
      })
      .refine((n) => n === null || n <= 99_999_999.99, {
        message: "Amount is too large",
      }),
  );

const nonNegativeInt = z
  .union([z.string(), z.number()])
  .transform((value) => {
    if (value === "" || value === undefined || value === null) return 0;
    const n = typeof value === "number" ? value : Number(value);
    return Number.isNaN(n) ? 0 : Math.trunc(n);
  })
  .pipe(
    z
      .number()
      .int()
      .min(0, { message: "Value cannot be negative" })
      .max(1_000_000, { message: "Value is too large" }),
  );

export const itemStatusEnum = z.enum(["ACTIVE", "ARCHIVED", "DRAFT"]);
export type ItemStatusInput = z.infer<typeof itemStatusEnum>;

export const itemInputSchema = z.object({
  sku: z
    .string()
    .trim()
    .min(1, { message: "SKU is required" })
    .max(64, { message: "SKU must be 64 characters or fewer" })
    .regex(/^[A-Za-z0-9._\-/]+$/, {
      message: "SKU can only contain letters, numbers, dots, dashes, slashes, underscores",
    }),
  name: z
    .string()
    .trim()
    .min(1, { message: "Name is required" })
    .max(160, { message: "Name must be 160 characters or fewer" }),
  description: optionalString,
  barcode: z
    .string()
    .trim()
    .max(64)
    .optional()
    .transform((value) => (value === "" || value === undefined ? null : value)),
  categoryId: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value === "" || value === undefined ? null : value)),
  unit: z
    .string()
    .trim()
    .min(1, { message: "Unit is required" })
    .max(16, { message: "Unit must be 16 characters or fewer" })
    .default("each"),
  costPrice: optionalDecimal,
  salePrice: optionalDecimal,
  currency: z
    .string()
    .trim()
    .length(3, { message: "Currency must be a 3-letter ISO code" })
    .regex(/^[A-Z]{3}$/, { message: "Currency must be uppercase ISO 4217" })
    .default("USD"),
  reorderPoint: nonNegativeInt,
  reorderQty: nonNegativeInt,
  status: itemStatusEnum.default("ACTIVE"),
  imageUrl: z
    .string()
    .trim()
    .url({ message: "Image URL must be a valid URL" })
    .optional()
    .or(z.literal(""))
    .transform((value) => (value === "" || value === undefined ? null : value)),
});

export type ItemInput = z.input<typeof itemInputSchema>;
export type ItemOutput = z.output<typeof itemInputSchema>;

export const categoryInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Category name is required" })
    .max(80, { message: "Category name must be 80 characters or fewer" }),
  description: optionalString,
  parentId: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value === "" || value === undefined ? null : value)),
});

export type CategoryInput = z.input<typeof categoryInputSchema>;
export type CategoryOutput = z.output<typeof categoryInputSchema>;
