import { z } from "zod";

export const binInputSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, { message: "Bin code is required" })
    .max(32, { message: "Bin code must be 32 characters or fewer" })
    .regex(/^[A-Z0-9_\-./]+$/i, {
      message: "Code can only contain letters, numbers, dashes, underscores, dots, and slashes",
    })
    .transform((value) => value.toUpperCase()),
  label: z.string().trim().max(80).optional().nullable(),
  description: z.string().trim().max(200).optional().nullable(),
});

export type BinInput = z.input<typeof binInputSchema>;
export type BinOutput = z.output<typeof binInputSchema>;
