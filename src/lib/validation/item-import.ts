import { z } from "zod";

// Schema for a single imported item row AFTER column mapping — so this
// receives canonical field names already (sku, name, unit, …), not raw
// CSV column indexes.
//
// Differs from the interactive itemInputSchema because:
//   - imports often come from spreadsheets where currency can be "usd"
//     or "$", so we uppercase and strip the prefix before validating
//   - numeric fields come as strings from CSV; we normalise "1,234.56"
//     and stray whitespace
//   - status is optional (defaults to ACTIVE) because most templates
//     won't have a status column
//
// Duplicate SKU detection happens in the server action, not here — a
// single row has no way to know about its siblings.

const trimmed = z.string().trim();

const optionalTrimmed = trimmed
  .optional()
  .transform((v) => (v === "" || v === undefined ? null : v));

// Accepts "1,234.56", "  1234  ", "$12.50", "" → null | number.
const moneyLike = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === null || v === undefined) return null;
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    const cleaned = v
      .trim()
      .replace(/^[^\d.\-,]+/, "") // strip leading currency symbols
      .replace(/,/g, ""); // strip thousands separators
    if (cleaned === "") return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  })
  .pipe(
    z
      .number()
      .nullable()
      .refine((n) => n === null || n >= 0, { message: "Amount cannot be negative" })
      .refine((n) => n === null || n <= 99_999_999.99, { message: "Amount is too large" }),
  );

const nonNegativeIntString = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === null || v === undefined) return 0;
    if (typeof v === "number") return Math.trunc(v);
    const cleaned = v.trim().replace(/,/g, "");
    if (cleaned === "") return 0;
    const n = Number(cleaned);
    return Number.isFinite(n) ? Math.trunc(n) : Number.NaN;
  })
  .pipe(
    // IMPORTANT: keep refine() at the tail. Putting refine() before int/min/max
    // turns the type into ZodEffects<ZodNumber> and .int() stops being
    // available — which silently breaks Zod's type inference and makes every
    // downstream `parsed.data.X` collapse to `unknown`.
    z
      .number()
      .int({ message: "Value must be a whole number" })
      .min(0, { message: "Value cannot be negative" })
      .max(1_000_000, { message: "Value is too large" })
      .refine((n) => !Number.isNaN(n), { message: "Value must be a number" }),
  );

export const importItemStatusEnum = z.preprocess(
  (v) => {
    if (typeof v !== "string") return v;
    const trimmedValue = v.trim().toUpperCase();
    if (trimmedValue === "") return undefined;
    return trimmedValue;
  },
  z.enum(["ACTIVE", "ARCHIVED", "DRAFT"]).optional().default("ACTIVE"),
);

export const importItemRowSchema = z.object({
  sku: trimmed
    .min(1, { message: "SKU is required" })
    .max(64, { message: "SKU must be 64 characters or fewer" })
    .regex(/^[A-Za-z0-9._\-/]+$/, {
      message: "SKU can only contain letters, numbers, dots, dashes, slashes, underscores",
    }),
  name: trimmed
    .min(1, { message: "Name is required" })
    .max(160, { message: "Name must be 160 characters or fewer" }),
  description: optionalTrimmed,
  barcode: optionalTrimmed,
  unit: trimmed
    .min(1, { message: "Unit is required" })
    .max(16, { message: "Unit must be 16 characters or fewer" })
    .default("each"),
  costPrice: moneyLike,
  salePrice: moneyLike,
  currency: z
    .preprocess(
      (v) =>
        typeof v === "string"
          ? v
              .trim()
              .toUpperCase()
              .replace(/[^A-Z]/g, "") || undefined
          : v,
      z
        .string()
        .length(3, { message: "Currency must be a 3-letter ISO code" })
        .regex(/^[A-Z]{3}$/, { message: "Currency must be uppercase ISO 4217" })
        .default("USD"),
    )
    .default("USD"),
  reorderPoint: nonNegativeIntString,
  reorderQty: nonNegativeIntString,
  status: importItemStatusEnum,
});

export type ImportItemRowInput = z.input<typeof importItemRowSchema>;
export type ImportItemRowOutput = z.output<typeof importItemRowSchema>;

// Canonical field → list of header aliases that auto-map to that field.
// Order matters: the first alias that matches wins. Lowercased and
// whitespace-stripped when auto-matching, so "Sale Price" matches "saleprice".
export const IMPORT_FIELD_ALIASES: Readonly<Record<string, readonly string[]>> = {
  sku: ["sku", "itemsku", "productsku", "code", "itemcode", "stockkeepingunit"],
  name: ["name", "itemname", "productname", "description", "title"],
  description: ["description", "longdescription", "details", "notes"],
  barcode: ["barcode", "ean", "upc", "gtin"],
  unit: ["unit", "uom", "unitofmeasure", "measure"],
  costPrice: ["costprice", "cost", "buyprice", "unitcost"],
  salePrice: ["saleprice", "price", "sellprice", "retailprice"],
  currency: ["currency", "currencycode", "iso"],
  reorderPoint: ["reorderpoint", "minqty", "minimum", "safetystock"],
  reorderQty: ["reorderqty", "reorderquantity", "defaultorderqty"],
  status: ["status", "state"],
};

/**
 * Bulk validate a list of mapped rows. Returns a partitioned result so
 * the UI can show "N rows ready to import, M rows rejected" with per-row
 * error messages. Also detects duplicate SKUs WITHIN the file itself
 * (duplicate-against-database is the caller's job).
 */
export type ImportValidationIssue = {
  rowIndex: number; // zero-based, matches source array
  sku: string | null;
  errors: string[];
};

export type ImportValidationResult = {
  valid: Array<{ rowIndex: number; row: ImportItemRowOutput }>;
  invalid: ImportValidationIssue[];
  duplicateSkus: string[]; // SKUs that appeared more than once in the file
};

export function validateImportRows(
  rawRows: readonly Record<string, unknown>[],
): ImportValidationResult {
  const MAX_IMPORT_ROWS = 10_000;
  if (rawRows.length > MAX_IMPORT_ROWS) {
    return {
      valid: [],
      invalid: [
        {
          rowIndex: 0,
          sku: null,
          errors: [
            `Import limited to ${MAX_IMPORT_ROWS} rows. File has ${rawRows.length}.`,
          ],
        },
      ],
      duplicateSkus: [],
    };
  }

  const valid: ImportValidationResult["valid"] = [];
  const invalid: ImportValidationIssue[] = [];
  const seenSkus = new Map<string, number>();
  const duplicateSkus = new Set<string>();

  rawRows.forEach((raw, rowIndex) => {
    const parsed = importItemRowSchema.safeParse(raw);
    if (!parsed.success) {
      const errors: string[] = [];
      for (const [field, messages] of Object.entries(parsed.error.flatten().fieldErrors)) {
        if (messages && messages.length > 0) {
          errors.push(`${field}: ${messages.join(", ")}`);
        }
      }
      if (errors.length === 0) {
        for (const issue of parsed.error.issues) errors.push(issue.message);
      }
      invalid.push({
        rowIndex,
        sku: typeof raw.sku === "string" ? raw.sku : null,
        errors,
      });
      return;
    }

    // Dedup within the same file — we accept the first occurrence and
    // mark subsequent ones as invalid. This matches the user's mental
    // model: "fix the duplicate, re-import".
    const sku = parsed.data.sku;
    const previousIndex = seenSkus.get(sku);
    if (previousIndex !== undefined) {
      duplicateSkus.add(sku);
      invalid.push({
        rowIndex,
        sku,
        errors: [`Duplicate SKU in file (first seen on row ${previousIndex + 1})`],
      });
      return;
    }
    seenSkus.set(sku, rowIndex);
    valid.push({ rowIndex, row: parsed.data });
  });

  return { valid, invalid, duplicateSkus: Array.from(duplicateSkus) };
}
