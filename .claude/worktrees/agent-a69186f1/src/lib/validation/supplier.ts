import { z } from "zod";

// Supplier master data. Most fields are optional because SMBs rarely have
// complete vendor records — we never want to block creating a supplier
// because the user didn't know the exact postal code at entry time.

const optionalTrimmedString = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, { message: `${label} must be ${max} characters or fewer` })
    .optional()
    .nullable()
    .transform((v) => (v === "" || v === undefined ? null : v));

export const supplierInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Supplier name is required" })
    .max(160, { message: "Name must be 160 characters or fewer" }),
  code: z
    .string()
    .trim()
    .max(32, { message: "Code must be 32 characters or fewer" })
    .regex(/^[A-Z0-9_\-]*$/i, {
      message: "Code can only contain letters, numbers, dashes, and underscores",
    })
    .optional()
    .nullable()
    .transform((v) => {
      if (v === "" || v === undefined || v === null) return null;
      return v.toUpperCase();
    }),
  contactName: optionalTrimmedString(120, "Contact name"),
  email: z
    .string()
    .trim()
    .max(160)
    .email({ message: "Must be a valid email address" })
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((v) => (v === "" || v === undefined || v === null ? null : v)),
  phone: optionalTrimmedString(40, "Phone"),
  addressLine1: optionalTrimmedString(160, "Address line 1"),
  addressLine2: optionalTrimmedString(160, "Address line 2"),
  city: optionalTrimmedString(80, "City"),
  region: optionalTrimmedString(80, "Region"),
  postalCode: optionalTrimmedString(20, "Postal code"),
  country: optionalTrimmedString(80, "Country"),
  website: z
    .string()
    .trim()
    .max(200)
    .url({ message: "Must be a valid URL" })
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((v) => (v === "" || v === undefined || v === null ? null : v)),
  notes: optionalTrimmedString(2000, "Notes"),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .length(3, { message: "Currency must be a 3-letter ISO code" })
    .regex(/^[A-Z]{3}$/, { message: "Currency must be uppercase ISO 4217" })
    .default("USD"),
  isActive: z.boolean().default(true),
});

export type SupplierInput = z.input<typeof supplierInputSchema>;
export type SupplierOutput = z.output<typeof supplierInputSchema>;
