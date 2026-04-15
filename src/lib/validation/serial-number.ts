import { z } from "zod";

export const createSerialSchema = z.object({
  itemId: z.string().cuid({ message: "Invalid item ID" }),
  serialNumber: z
    .string()
    .trim()
    .min(1, { message: "Serial number is required" })
    .max(100, { message: "Serial number must be 100 characters or fewer" }),
  warehouseId: z.string().cuid().optional().nullable(),
  binId: z.string().cuid().optional().nullable(),
  batchId: z.string().cuid().optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
});

export type CreateSerialInput = z.input<typeof createSerialSchema>;
export type CreateSerialOutput = z.output<typeof createSerialSchema>;

export const bulkCreateSerialsSchema = z.object({
  itemId: z.string().cuid({ message: "Invalid item ID" }),
  prefix: z
    .string()
    .trim()
    .min(1, { message: "Prefix is required" })
    .max(20, { message: "Prefix must be 20 characters or fewer" })
    .regex(/^[A-Z0-9_\-]+$/i, {
      message: "Prefix can only contain letters, numbers, dashes, and underscores",
    }),
  startNumber: z.number().int().positive({ message: "Start number must be positive" }),
  count: z.number().int().min(1).max(1000, { message: "Count must be between 1 and 1000" }),
  warehouseId: z.string().cuid().optional().nullable(),
});

export type BulkCreateSerialsInput = z.input<typeof bulkCreateSerialsSchema>;
export type BulkCreateSerialsOutput = z.output<typeof bulkCreateSerialsSchema>;

export const updateSerialStatusSchema = z.object({
  serialNumberId: z.string().cuid({ message: "Invalid serial number ID" }),
  status: z.enum(["IN_STOCK", "ISSUED", "IN_TRANSIT", "SOLD", "RETURNED", "DISPOSED", "LOST"], {
    message: "Invalid status",
  }),
  warehouseId: z.string().cuid().optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
});

export type UpdateSerialStatusInput = z.input<typeof updateSerialStatusSchema>;
export type UpdateSerialStatusOutput = z.output<typeof updateSerialStatusSchema>;

export const moveSerialSchema = z.object({
  serialNumberId: z.string().cuid({ message: "Invalid serial number ID" }),
  toWarehouseId: z.string().cuid({ message: "Invalid warehouse ID" }),
  note: z.string().trim().max(500).optional().nullable(),
});

export type MoveSerialInput = z.input<typeof moveSerialSchema>;
export type MoveSerialOutput = z.output<typeof moveSerialSchema>;
