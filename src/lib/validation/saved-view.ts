import { z } from "zod";

export const createSavedViewSchema = z.object({
  page: z
    .string()
    .min(1, { message: "Page is required" })
    .max(100, { message: "Page must be 100 characters or fewer" }),
  name: z
    .string()
    .trim()
    .min(1, { message: "View name is required" })
    .max(100, { message: "View name must be 100 characters or fewer" }),
  filters: z.record(z.any()),
  sortBy: z.string().optional().nullable(),
  sortOrder: z.enum(["asc", "desc"]).optional().nullable(),
  columns: z.array(z.string()).optional().default([]),
  isShared: z.boolean().optional().default(false),
});

export type CreateSavedViewInput = z.input<typeof createSavedViewSchema>;
export type CreateSavedViewOutput = z.output<typeof createSavedViewSchema>;

export const updateSavedViewSchema = createSavedViewSchema.partial();

export type UpdateSavedViewInput = z.input<typeof updateSavedViewSchema>;
export type UpdateSavedViewOutput = z.output<typeof updateSavedViewSchema>;

export const setDefaultViewSchema = z.object({
  id: z.string().cuid({ message: "Invalid view ID" }),
  page: z
    .string()
    .min(1, { message: "Page is required" })
    .max(100, { message: "Page must be 100 characters or fewer" }),
});

export type SetDefaultViewInput = z.input<typeof setDefaultViewSchema>;
export type SetDefaultViewOutput = z.output<typeof setDefaultViewSchema>;
