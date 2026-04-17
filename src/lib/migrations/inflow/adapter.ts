/**
 * Phase MIG-S2 — inFlow Cloud adapter.
 *
 * inFlow exports multiple CSV files:
 *   - Products.csv
 *   - Vendors.csv
 *   - StockLevels.csv
 *   - PurchaseOrders.csv + PurchaseOrderItems.csv
 *
 * All files are optional; the adapter gracefully handles missing ones.
 */

import type { MigrationAdapter, UploadedFile } from "@/lib/migrations/core/adapter";
import type {
  FileDetectionResult,
  FieldMapping,
  ParsedSnapshot,
  ValidationReport,
} from "@/lib/migrations/core/types";
import { parseCsv, sniffDelimiter } from "@/lib/migrations/core/csv-utils";
import { parseInflowCSV } from "@/lib/migrations/inflow/csv-parser";
import { getInflowDefaultMappings } from "@/lib/migrations/inflow/default-mappings";

export const INFLOW_ADAPTER: MigrationAdapter = {
  source: "INFLOW",
  method: "CSV",
  supportedFiles: ["Products.csv", "Vendors.csv", "StockLevels.csv", "PurchaseOrders.csv"],

  async detectFiles(files: UploadedFile[]): Promise<FileDetectionResult[]> {
    const expectedFiles = ["Products.csv", "Vendors.csv", "StockLevels.csv"];
    const detected = files.map((f) => ({
      filename: f.filename,
      detected: expectedFiles.some(
        (ex) => f.filename.toLowerCase() === ex.toLowerCase(),
      ),
      confidence: expectedFiles.some(
        (ex) => f.filename.toLowerCase() === ex.toLowerCase(),
      )
        ? 1.0
        : 0.0,
      issues: [],
    }));

    // Warn if critical files are missing.
    const missing = expectedFiles.filter(
      (ex) =>
        !files.some((f) => f.filename.toLowerCase() === ex.toLowerCase()),
    );

    if (missing.length > 0) {
      detected.push({
        filename: "MISSING",
        detected: false,
        confidence: 0,
        issues: [
          {
            severity: "WARNING",
            code: "INFLOW_MISSING_FILES",
            message: `Missing expected inFlow files: ${missing.join(", ")}`,
          },
        ],
      });
    }

    return detected;
  },

  async parse(files: UploadedFile[]): Promise<ParsedSnapshot> {
    // Parse each CSV file independently.
    const fileMap = new Map<string, Record<string, string>[]>();

    for (const file of files) {
      const delimiter = sniffDelimiter(file.buffer);
      const { headers, rows } = parseCsv(file.buffer, delimiter);
      fileMap.set(file.filename.toLowerCase(), rows);
    }

    return parseInflowCSV(fileMap);
  },

  suggestMappings(snapshot: ParsedSnapshot): FieldMapping[] {
    return getInflowDefaultMappings(snapshot);
  },

  validate(
    snapshot: ParsedSnapshot,
    mappings: FieldMapping[],
    scope: any,
  ): ValidationReport {
    const issues: any[] = [];

    // Validate products have SKU.
    for (const item of snapshot.items) {
      if (!item.sku || item.sku.trim() === "") {
        issues.push({
          severity: "ERROR",
          code: "ITEM_MISSING_SKU",
          message: `Product "${item.name || item.externalId}" is missing a SKU`,
        });
      }
    }

    // Validate supplier references.
    for (const item of snapshot.items) {
      if (
        item.preferredSupplierExternalId &&
        !snapshot.suppliers.some(
          (s) => s.externalId === item.preferredSupplierExternalId,
        )
      ) {
        issues.push({
          severity: "WARNING",
          code: "ITEM_VENDOR_NOT_FOUND",
          message: `Product "${item.name}" references unknown vendor ${item.preferredSupplierExternalId}`,
        });
      }
    }

    return {
      valid: issues.every((i) => i.severity !== "ERROR"),
      issues,
    };
  },
};
