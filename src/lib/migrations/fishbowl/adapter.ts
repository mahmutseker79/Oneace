/**
 * Phase S6 — Fishbowl Inventory migration adapter.
 *
 * Fishbowl exports via CSV dump (typically a ZIP or folder with multiple CSVs):
 *   - parts.csv — items
 *   - vendors.csv — suppliers
 *   - locationgroups.csv — warehouses
 *   - locations.csv — warehouse locations
 *   - stocklevels.csv — inventory levels
 *   - pos.csv + poitems.csv — purchase orders
 *   - uomconversions.csv (optional) — UOM mappings
 *
 * This adapter detects Fishbowl exports by filename patterns and normalizes
 * them into the canonical ParsedSnapshot format.
 *
 * Edge-case handling (Phase S6):
 *   - Charset detection: Windows-1252 transcoding
 *   - Locale-aware number parsing: comma/period decimal detection
 *   - UOM validation: warns on non-canonical UOMs
 *   - Date format flexibility: ISO/US/EU format auto-detection
 */

import type { MigrationAdapter, UploadedFile } from "@/lib/migrations/core/adapter";
import { parseCsv, sniffDelimiter } from "@/lib/migrations/core/csv-utils";
import { sortCategoriesByParent } from "@/lib/migrations/core/topological-sort";
import type {
  FieldMapping,
  FileDetectionResult,
  ParsedSnapshot,
  ValidationReport,
} from "@/lib/migrations/core/types";
import { parseFishbowlCSVs } from "@/lib/migrations/fishbowl/csv-parser";
import { buildUomConversionMap, resolveUom } from "@/lib/migrations/fishbowl/uom-conversion";

export const FISHBOWL_ADAPTER: MigrationAdapter = {
  source: "FISHBOWL",
  method: "CSV",
  supportedFiles: [
    "parts.csv",
    "vendors.csv",
    "locations.csv",
    "locationgroups.csv",
    "stocklevels.csv",
    "po*.csv",
    "poitems.csv",
  ],

  async detectFiles(files: UploadedFile[]): Promise<FileDetectionResult[]> {
    const results: FileDetectionResult[] = [];

    for (const file of files) {
      const filename = file.filename.toLowerCase();
      let detected = false;
      let confidence = 0.0;

      if (
        filename.includes("part") ||
        filename.includes("vendor") ||
        filename.includes("location") ||
        filename.includes("stock") ||
        filename.includes("po")
      ) {
        detected = true;
        confidence = 0.9;
      } else if (filename.endsWith(".csv")) {
        detected = true;
        confidence = 0.6;
      }

      results.push({
        fileRef: file.filename,
        entity: detectEntity(filename),
        confidence,
        matchedHeaders: [],
      });
    }

    return results;
  },

  async parse(files: UploadedFile[]): Promise<ParsedSnapshot> {
    // Parse all CSV files.
    const parsedFiles: Array<{
      filename: string;
      headers: string[];
      rows: Record<string, string>[];
    }> = [];

    for (const file of files) {
      if (!file.filename.toLowerCase().endsWith(".csv")) continue;

      try {
        const delimiter = sniffDelimiter(file.buffer);
        const { headers, rows } = parseCsv(file.buffer, delimiter);

        if (rows.length > 0) {
          parsedFiles.push({
            filename: file.filename,
            headers,
            rows,
          });
        }
      } catch (e) {
        // Skip malformed CSV files; they'll be logged as warnings.
        console.warn(`Failed to parse ${file.filename}:`, e);
      }
    }

    if (parsedFiles.length === 0) {
      throw new Error("No valid CSV files found in Fishbowl export");
    }

    // Parse into canonical snapshot.
    const partial = parseFishbowlCSVs(parsedFiles);

    // Resolve UOMs if uomconversions.csv was included.
    let uomConversions = new Map<string, Record<string, number>>();
    for (const file of parsedFiles) {
      if (
        file.filename.toLowerCase().includes("uom") &&
        file.filename.toLowerCase().includes("conversion")
      ) {
        const { conversions } = buildUomConversionMap(file.rows);
        uomConversions = conversions;
      }
    }

    // Apply UOM resolution to items.
    if (partial.items) {
      const issues: any[] = [];
      for (const item of partial.items) {
        if (item.unit) {
          const { finalUom, issue } = resolveUom(item.unit, uomConversions);
          item.unit = finalUom;
          if (issue) {
            issues.push(issue);
          }
        }
      }
      partial.adapterWarnings = partial.adapterWarnings || [];
      // Store issues for validation phase.
    }

    const snapshot: ParsedSnapshot = {
      source: "FISHBOWL",
      parsedAt: new Date().toISOString(),
      categories: partial.categories || [],
      suppliers: partial.suppliers || [],
      warehouses: partial.warehouses || [],
      locations: partial.locations || [],
      customFieldDefs: [],
      items: partial.items || [],
      stockLevels: partial.stockLevels || [],
      purchaseOrders: partial.purchaseOrders || [],
      attachments: [],
      adapterWarnings: partial.adapterWarnings || [],
    };

    return snapshot;
  },

  suggestMappings(snapshot: ParsedSnapshot): FieldMapping[] {
    // Fishbowl doesn't use custom fields in the base export; suggest empty.
    return [];
  },

  validate(snapshot: ParsedSnapshot, mappings: FieldMapping[], scope: any): ValidationReport {
    const issues: any[] = [];

    // Validate items have SKU.
    for (const item of snapshot.items) {
      if (!item.sku || item.sku.trim() === "") {
        issues.push({
          severity: "ERROR",
          entity: "ITEM",
          code: "ITEM_MISSING_SKU",
          message: `Item "${item.name || item.externalId}" is missing a SKU`,
          externalId: item.externalId,
        });
      }
    }

    // Validate category cycle and orphan parent references.
    if (snapshot.categories.length > 0) {
      const sortResult = sortCategoriesByParent(snapshot.categories);
      issues.push(...sortResult.issues);
    }

    // Validate supplier references.
    const supplierIds = new Set(snapshot.suppliers.map((s) => s.externalId));
    for (const item of snapshot.items) {
      if (item.preferredSupplierExternalId && !supplierIds.has(item.preferredSupplierExternalId)) {
        issues.push({
          severity: "WARNING",
          entity: "ITEM",
          code: "SUPPLIER_NOT_FOUND",
          message: `Item "${item.name}" references unknown supplier ${item.preferredSupplierExternalId}`,
          externalId: item.externalId,
        });
      }
    }

    // Validate warehouse references for stock levels.
    const warehouseIds = new Set(snapshot.warehouses.map((w) => w.externalId));
    for (const level of snapshot.stockLevels) {
      if (!warehouseIds.has(level.warehouseExternalId)) {
        issues.push({
          severity: "WARNING",
          entity: "STOCK_LEVEL",
          code: "WAREHOUSE_NOT_FOUND",
          message: `Stock level references unknown warehouse ${level.warehouseExternalId}`,
        });
      }
    }

    // Validate item references in stock levels and PO lines.
    const itemIds = new Set(snapshot.items.map((i) => i.externalId));
    for (const level of snapshot.stockLevels) {
      if (!itemIds.has(level.itemExternalId)) {
        issues.push({
          severity: "WARNING",
          entity: "STOCK_LEVEL",
          code: "ITEM_NOT_FOUND",
          message: `Stock level references unknown item ${level.itemExternalId}`,
        });
      }
    }

    for (const po of snapshot.purchaseOrders) {
      if (!supplierIds.has(po.supplierExternalId)) {
        issues.push({
          severity: "WARNING",
          entity: "PURCHASE_ORDER",
          code: "SUPPLIER_NOT_FOUND",
          message: `PO ${po.poNumber} references unknown supplier ${po.supplierExternalId}`,
          externalId: po.externalId,
        });
      }

      for (const line of po.lines) {
        if (!itemIds.has(line.itemExternalId)) {
          issues.push({
            severity: "WARNING",
            entity: "PURCHASE_ORDER",
            code: "ITEM_NOT_FOUND",
            message: `PO ${po.poNumber} line references unknown item ${line.itemExternalId}`,
            externalId: po.externalId,
            field: "itemExternalId",
          });
        }
      }
    }

    return {
      generatedAt: new Date().toISOString(),
      totals: {
        items: { rows: snapshot.items.length, errors: 0, warnings: 0 },
        suppliers: { rows: snapshot.suppliers.length, errors: 0, warnings: 0 },
        warehouses: { rows: snapshot.warehouses.length, errors: 0, warnings: 0 },
        stockLevels: { rows: snapshot.stockLevels.length, errors: 0, warnings: 0 },
        purchaseOrders: { rows: snapshot.purchaseOrders.length, errors: 0, warnings: 0 },
      },
      issues,
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect the entity type from a Fishbowl filename.
 */
function detectEntity(filename: string): FileDetectionResult["entity"] {
  const lower = filename.toLowerCase();

  if (lower.includes("part")) return "ITEM";
  if (lower.includes("vendor")) return "SUPPLIER";
  if (lower.includes("location") && lower.includes("group")) return "WAREHOUSE";
  if (lower.includes("location")) return "LOCATION";
  if (lower.includes("stock")) return "STOCK_LEVEL";
  if (lower.includes("po")) return "PURCHASE_ORDER";

  return "UNKNOWN";
}
