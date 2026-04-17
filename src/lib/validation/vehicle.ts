import { z } from "zod";

export const createVehicleSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  licensePlate: z.string().min(1, "License plate is required").max(30),
  description: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
});

export const updateVehicleSchema = createVehicleSchema.partial();

export const loadShipmentSchema = z.object({
  vehicleId: z.string().cuid(),
  salesOrderId: z.string().cuid().optional(),
  notes: z.string().max(500).optional(),
});

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
export type LoadShipmentInput = z.infer<typeof loadShipmentSchema>;
