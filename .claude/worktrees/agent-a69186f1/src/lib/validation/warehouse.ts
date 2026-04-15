import { z } from "zod";

export const warehouseInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Warehouse name is required" })
    .max(80, { message: "Warehouse name must be 80 characters or fewer" }),
  code: z
    .string()
    .trim()
    .min(1, { message: "Warehouse code is required" })
    .max(16, { message: "Warehouse code must be 16 characters or fewer" })
    .regex(/^[A-Z0-9_-]+$/i, {
      message: "Code can only contain letters, numbers, dashes, and underscores",
    })
    .transform((value) => value.toUpperCase()),
  address: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().max(80).optional().nullable(),
  region: z.string().trim().max(80).optional().nullable(),
  country: z.string().trim().max(80).optional().nullable(),
  isDefault: z.boolean().default(false),
});

export type WarehouseInput = z.input<typeof warehouseInputSchema>;
export type WarehouseOutput = z.output<typeof warehouseInputSchema>;
