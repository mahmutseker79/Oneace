import { z } from "zod";

// Accepts empty string → null, empty string → undefined, or valid value.
// Used for optional text fields from HTML form inputs.
const optionalString = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((value) => (value === "" || value === undefined ? null : value));

export const barcodeFormatEnum = z.enum(["CODE128", "EAN13", "QR", "CODE39", "UPC_A", "ITF14"]);
export type BarcodeFormatInput = z.infer<typeof barcodeFormatEnum>;

export const createCountZoneInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Zone name is required" })
    .max(160, { message: "Zone name must be 160 characters or fewer" }),
  description: optionalString,
  color: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, { message: "Color must be a valid hex code (e.g. #FF0000)" })
    .optional()
    .transform((value) => (value === "" || value === undefined ? null : value)),
  barcodeValue: optionalString,
  barcodeFormat: barcodeFormatEnum.default("QR"),
  stockCountId: z.string().min(1, { message: "Stock count ID is required" }),
  parentZoneId: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value === "" || value === undefined ? null : value)),
  promoteToBin: z.boolean().default(false),
});

export type CreateCountZoneInput = z.input<typeof createCountZoneInputSchema>;
export type CreateCountZoneOutput = z.output<typeof createCountZoneInputSchema>;

export const updateCountZoneInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Zone name is required" })
    .max(160, { message: "Zone name must be 160 characters or fewer" })
    .optional(),
  description: optionalString,
  color: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, { message: "Color must be a valid hex code (e.g. #FF0000)" })
    .optional()
    .transform((value) => (value === "" || value === undefined ? null : value)),
  barcodeValue: optionalString,
  barcodeFormat: barcodeFormatEnum.optional(),
  parentZoneId: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value === "" || value === undefined ? null : value)),
  promoteToBin: z.boolean().optional(),
});

export type UpdateCountZoneInput = z.input<typeof updateCountZoneInputSchema>;
export type UpdateCountZoneOutput = z.output<typeof updateCountZoneInputSchema>;
