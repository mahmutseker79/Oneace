import { z } from "zod";

export const createLocationLevelSchema = z.object({
  warehouseId: z.string().cuid({ message: "Invalid warehouse ID" }),
  parentId: z.string().cuid().optional().nullable(),
  type: z.enum(["ZONE", "AISLE", "RACK", "SHELF", "BAY", "FLOOR"], {
    message: "Invalid location type",
  }),
  name: z
    .string()
    .trim()
    .min(1, { message: "Location name is required" })
    .max(100, { message: "Location name must be 100 characters or fewer" }),
  code: z
    .string()
    .trim()
    .min(1, { message: "Location code is required" })
    .max(20, { message: "Location code must be 20 characters or fewer" })
    .regex(/^[A-Z0-9_\-]+$/i, {
      message: "Code can only contain letters, numbers, dashes, and underscores",
    })
    .transform((value) => value.toUpperCase()),
  barcodeValue: z.string().trim().max(100).optional().nullable(),
});

export type CreateLocationLevelInput = z.input<typeof createLocationLevelSchema>;
export type CreateLocationLevelOutput = z.output<typeof createLocationLevelSchema>;

export const updateLocationLevelSchema = createLocationLevelSchema
  .partial()
  .omit({ warehouseId: true });

export type UpdateLocationLevelInput = z.input<typeof updateLocationLevelSchema>;
export type UpdateLocationLevelOutput = z.output<typeof updateLocationLevelSchema>;

export const deleteLocationLevelSchema = z.object({
  id: z.string().cuid({ message: "Invalid location ID" }),
  warehouseId: z.string().cuid({ message: "Invalid warehouse ID" }),
});

export type DeleteLocationLevelInput = z.input<typeof deleteLocationLevelSchema>;
export type DeleteLocationLevelOutput = z.output<typeof deleteLocationLevelSchema>;

export const reorderLocationLevelsSchema = z.object({
  warehouseId: z.string().cuid({ message: "Invalid warehouse ID" }),
  ids: z.array(z.string().cuid()).min(1, { message: "At least one location ID is required" }),
});

export type ReorderLocationLevelsInput = z.input<typeof reorderLocationLevelsSchema>;
export type ReorderLocationLevelsOutput = z.output<typeof reorderLocationLevelsSchema>;
