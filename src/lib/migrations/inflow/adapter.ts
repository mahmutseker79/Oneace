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
import { parseCsv, sniffDelimiter } from "@/lib/migrations/core/csv-utils";
import type {
  FieldMapping,
  FileDetectionResult,
  ParsedSnapshot,
  ValidationReport,
} from "@/lib/migrations/core/types";
import { parseInflowCSV } from "@/lib/migrations/inflow/csv-parser";
import { getInflowDefaultMappings } from "@/lib/migrations/inflow/default-mappings";

export const INFLOW_ADAPTER: MigrationAdapter = {
  source: "INFLOW",
  method: "CSV",
  supportedFiles: ["Products.csv", "Vendors.csv", "StockLevels.csv", "PurchaseOrders.csv"],

  async detectFiles(files: UploadedFile[]): Promise<FileDetectionResult[]> {
    const expectedFiles = ["Products.csv", "Vendors.csv", "StockLevels.csv"];
    const detected: FileDetectionResult[] = files.map((f) => {
      const matches = expectedFiles.some((ex) => f.filename.toLowerCase() === ex.toLowerCase());
      return {
        fileRef: f.filename,
        entity: matches ? "ITEM" : "UNKNOWN",
        confidence: matches ? 1.0 : 0.0,
        matchedHeaders: [],
      };
    });

    // Note: missing-file warnings are surfaced via validate() instead of
    // stuffing a synthetic FileDetectionResult; that shape requires fileRef
    // to map to a real upload.

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

  validate(snapshot: ParsedSnapshot, _mappings: FieldMapping[], _scope: unknown): ValidationReport {
    const issues: ValidationReport["issues"] = [];

    // Validate products have SKU.
    for (const item of snapshot.items) {
      if (!item.sku || item.sku.trim() === "") {
        issues.push({
          severity: "ERROR",
          entity: "ITEM",
          externalId: item.externalId,
          field: "sku",
          code: "ITEM_MISSING_SKU",
          message: `Product "${item.name || item.externalId}" is missing a SKU`,
        });
      }
    }

    // Validate supplier references.
    for (const item of snapshot.items) {
      if (
        item.preferredSupplierExternalId &&
        !snapshot.suppliers.some((s) => s.externalId === item.preferredSupplierExternalId)
      ) {
        issues.push({
          severity: "WARNING",
          entity: "ITEM",
          externalId: item.externalId,
          field: "preferredSupplierExternalId",
          code: "ITEM_VENDOR_NOT_FOUND",
          message: `Product "${item.name}" references unknown vendor ${item.preferredSupplierExternalId}`,
        });
      }
    }

    return {
      generatedAt: new Date().toISOString(),
      totals: {},
      issues,
    };
  },
};
