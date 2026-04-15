import { z } from "zod";

/**
 * Label template validation schema.
 * Validates label template creation and editing.
 */
export const labelTemplateInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Template name is required" })
    .max(120, { message: "Template name must be 120 characters or fewer" }),
  type: z.enum(["BIN", "ITEM", "WAREHOUSE", "CUSTOM"], {
    errorMap: () => ({ message: "Invalid label type" }),
  }),
  width: z
    .number()
    .positive({ message: "Width must be a positive number" })
    .max(500, { message: "Width must be 500 mm or less" }),
  height: z
    .number()
    .positive({ message: "Height must be a positive number" })
    .max(500, { message: "Height must be 500 mm or less" }),
  barcodeFormat: z
    .enum(["CODE128", "EAN13", "QR", "CODE39", "UPC_A", "ITF14"], {
      errorMap: () => ({ message: "Invalid barcode format" }),
    })
    .optional(),
  layout: z
    .record(z.unknown())
    .optional()
    .describe("JSON layout configuration for label fields"),
  isDefault: z.boolean().optional(),
});

export type LabelTemplateInput = z.input<typeof labelTemplateInputSchema>;
export type LabelTemplateOutput = z.output<typeof labelTemplateInputSchema>;
