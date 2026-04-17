/**
 * Phase MIG-S2 — Sortly adapter.
 *
 * Sortly exports a single CSV file with columns like:
 *   - Name, SKU, Quantity, Folder (path), Folder Path, Tags
 *   - Price, Min Level, Notes
 *   - Custom fields as "Field: <name>" columns
 *   - Photos as pipe-separated filenames
 *
 * See default-mappings.ts for column mappings.
 */

import type { MigrationAdapter, UploadedFile } from "@/lib/migrations/core/adapter";
import type {
  FileDetectionResult,
  FieldMapping,
  ParsedSnapshot,
  ValidationReport,
} from "@/lib/migrations/core/types";
import { parseCsv, sniffDelimiter } from "@/lib/migrations/core/csv-utils";
import { parseSortlyCSV } from "@/lib/migrations/sortly/csv-parser";
import { getSortlyDefaultMappings } from "@/lib/migrations/sortly/default-mappings";

export const SORTLY_ADAPTER: MigrationAdapter = {
  source: "SORTLY",
  method: "CSV",
  supportedFiles: ["items.csv", "*.csv"],

  async detectFiles(files: UploadedFile[]): Promise<FileDetectionResult[]> {
    return files.map((f) => ({
      filename: f.filename,
      detected: f.filename.toLowerCase().endsWith(".csv"),
      confidence:
        f.filename.toLowerCase() === "items.csv"
          ? 1.0
          : f.filename.toLowerCase().endsWith(".csv")
            ? 0.8
            : 0.0,
      issues: [],
    }));
  },

  async parse(files: UploadedFile[]): Promise<ParsedSnapshot> {
    // Find the CSV file.
    const csvFile = files.find((f) =>
      f.filename.toLowerCase().endsWith(".csv"),
    );
    if (!csvFile) {
      throw new Error("No CSV file found in upload");
    }

    // Parse CSV.
    const delimiter = sniffDelimiter(csvFile.buffer);
    const { headers, rows } = parseCsv(csvFile.buffer, delimiter);

    if (rows.length === 0) {
      throw new Error("CSV file is empty");
    }

    // Parse into canonical snapshot.
    return parseSortlyCSV(headers, rows);
  },

  suggestMappings(snapshot: ParsedSnapshot): FieldMapping[] {
    return getSortlyDefaultMappings(snapshot);
  },

  validate(
    snapshot: ParsedSnapshot,
    mappings: FieldMapping[],
    scope: any,
  ): ValidationReport {
    const issues: any[] = [];

    // Validate items have SKU.
    for (const item of snapshot.items) {
      if (!item.sku || item.sku.trim() === "") {
        issues.push({
          severity: "ERROR",
          code: "ITEM_MISSING_SKU",
          message: `Item "${item.name || item.externalId}" is missing a SKU`,
        });
      }
    }

    // Validate categories don't have cycles (simple check).
    const categoryIds = new Set(snapshot.categories.map((c) => c.externalId));
    for (const cat of snapshot.categories) {
      if (cat.parentExternalId && !categoryIds.has(cat.parentExternalId)) {
        issues.push({
          severity: "WARNING",
          code: "CATEGORY_PARENT_NOT_FOUND",
          message: `Category "${cat.name}" references unknown parent ${cat.parentExternalId}`,
        });
      }
    }

    return {
      valid: issues.every((i) => i.severity !== "ERROR"),
      issues,
    };
  },
};
