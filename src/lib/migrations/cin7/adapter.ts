/**
 * Phase MIG-S5 — Cin7 Core REST API adapter.
 *
 * Cin7 is an API-only source; there are no uploaded files.
 * Credentials (accountId + applicationKey) are stored on
 * MigrationJob.fieldMappings.credentials and passed here.
 */

import type { MigrationAdapter } from "@/lib/migrations/core/adapter";
import type {
  FileDetectionResult,
  FieldMapping,
  ParsedSnapshot,
  ValidationReport,
} from "@/lib/migrations/core/types";
import type { MigrationScopeOptions } from "@/lib/migrations/core/scope-options";
import {
  resolvePoHistoryCutoff,
  shouldImportPurchaseOrders,
} from "@/lib/migrations/core/scope-options";
import {
  Cin7ApiClient,
  type Cin7Credentials,
} from "@/lib/migrations/cin7/api-client";
import { getCin7DefaultMappings } from "@/lib/migrations/cin7/default-mappings";
import { parseCin7Snapshot } from "@/lib/migrations/cin7/parser";

/**
 * Helper to extract Cin7 credentials from fieldMappings.
 * Returns null if credentials are missing or malformed.
 */
function extractCin7Credentials(
  fieldMappings: Record<string, unknown>,
): Cin7Credentials | null {
  const creds = fieldMappings.credentials;
  if (
    creds &&
    typeof creds === "object" &&
    "accountId" in creds &&
    "applicationKey" in creds
  ) {
    const c = creds as Record<string, unknown>;
    if (typeof c.accountId === "string" && typeof c.applicationKey === "string") {
      return {
        accountId: c.accountId,
        applicationKey: c.applicationKey,
      };
    }
  }
  return null;
}

export const CIN7_ADAPTER: MigrationAdapter = {
  source: "CIN7",
  method: "API",
  supportedFiles: [], // API-only; no file upload

  async detectFiles(): Promise<FileDetectionResult[]> {
    // No files to detect for API sources
    return [];
  },

  async parse(
    _files,
    fieldMappings?: Record<string, unknown>,
  ): Promise<ParsedSnapshot> {
    if (!fieldMappings) {
      throw new Error("Cin7 adapter requires credentials in fieldMappings");
    }

    const creds = extractCin7Credentials(fieldMappings);
    if (!creds) {
      throw new Error(
        "Cin7 credentials (accountId, applicationKey) not found in fieldMappings.credentials",
      );
    }

    const client = new Cin7ApiClient(creds);

    // Fetch all entities in parallel where possible
    const [products, suppliers, locations, stockItems, purchases, attachments] =
      await Promise.all([
        client.getAllProducts(),
        client.getAllSuppliers(),
        client.getAllLocations(),
        client.getAllStockItems(),
        client.getAllPurchases(),
        Promise.all([]).then(() => ({})), // Placeholder for attachment collection
      ]);

    // Fetch attachments per product (no dedicated batch endpoint)
    const attachmentsByProduct: Record<string, typeof attachments[]> = {};
    for (const product of products) {
      const atts = await client.getProductAttachments(product.ID);
      if (atts.length > 0) {
        attachmentsByProduct[product.ID] = atts;
      }
    }

    // Parse into canonical snapshot
    return parseCin7Snapshot({
      products,
      suppliers,
      locations,
      stockItems,
      purchases,
      attachmentsByProduct,
    });
  },

  /**
   * This is called with fieldMappings as the second parameter,
   * after parse() has been called. We override the signature
   * to accept fieldMappings here too.
   */
  async parseWithScope(
    _files,
    fieldMappings: Record<string, unknown>,
    scope: MigrationScopeOptions,
  ): Promise<ParsedSnapshot> {
    if (!fieldMappings) {
      throw new Error("Cin7 adapter requires credentials in fieldMappings");
    }

    const creds = extractCin7Credentials(fieldMappings);
    if (!creds) {
      throw new Error(
        "Cin7 credentials (accountId, applicationKey) not found in fieldMappings.credentials",
      );
    }

    const client = new Cin7ApiClient(creds);

    // Fetch all entities
    const [products, suppliers, locations, stockItems] = await Promise.all([
      client.getAllProducts(),
      client.getAllSuppliers(),
      client.getAllLocations(),
      client.getAllStockItems(),
    ]);

    // Fetch purchases respecting scope
    let purchases: any[] = [];
    if (shouldImportPurchaseOrders(scope)) {
      const cutoff = resolvePoHistoryCutoff(scope.poHistory);
      purchases = await client.getAllPurchases(cutoff ?? undefined);

      // Filter by status if scope.poHistory === "OPEN_ONLY"
      if (scope.poHistory === "OPEN_ONLY") {
        const closedStatuses = ["RECEIVED", "CLOSED", "CANCELLED"];
        purchases = purchases.filter(
          (po) => !closedStatuses.includes(String(po.Status)),
        );
      }
    }

    // Fetch attachments if enabled
    const attachmentsByProduct: Record<string, any[]> = {};
    if (scope.includeAttachments) {
      for (const product of products) {
        const atts = await client.getProductAttachments(product.ID);
        if (atts.length > 0) {
          attachmentsByProduct[product.ID] = atts;
        }
      }
    }

    return parseCin7Snapshot({
      products,
      suppliers,
      locations,
      stockItems,
      purchases,
      attachmentsByProduct,
    });
  },

  suggestMappings(snapshot: ParsedSnapshot): FieldMapping[] {
    return getCin7DefaultMappings(snapshot);
  },

  validate(
    snapshot: ParsedSnapshot,
    _mappings: FieldMapping[],
    _scope: any,
  ): ValidationReport {
    const issues: any[] = [];

    // Validate all items have SKU
    for (const item of snapshot.items) {
      if (!item.sku || item.sku.trim() === "") {
        issues.push({
          severity: "ERROR",
          entity: "ITEM",
          externalId: item.externalId,
          field: "sku",
          code: "ITEM_MISSING_SKU",
          message: `Item "${item.name || item.externalId}" is missing a SKU`,
        });
      }
    }

    // Validate category parents exist
    const categoryIds = new Set(snapshot.categories.map((c) => c.externalId));
    for (const cat of snapshot.categories) {
      if (cat.parentExternalId && !categoryIds.has(cat.parentExternalId)) {
        issues.push({
          severity: "WARNING",
          entity: "CATEGORY",
          externalId: cat.externalId,
          field: "parentExternalId",
          code: "CATEGORY_PARENT_NOT_FOUND",
          message: `Category "${cat.name}" references unknown parent ${cat.parentExternalId}`,
        });
      }
    }

    // Validate warehouse references
    const warehouseIds = new Set(
      snapshot.warehouses.map((w) => w.externalId),
    );
    for (const loc of snapshot.locations) {
      if (!warehouseIds.has(loc.warehouseExternalId)) {
        issues.push({
          severity: "ERROR",
          entity: "LOCATION",
          externalId: loc.externalId,
          field: "warehouseExternalId",
          code: "LOCATION_WAREHOUSE_NOT_FOUND",
          message: `Location "${loc.name}" references unknown warehouse ${loc.warehouseExternalId}`,
        });
      }
    }

    // Validate stock levels reference existing items and warehouses
    const itemIds = new Set(snapshot.items.map((i) => i.externalId));
    for (const stock of snapshot.stockLevels) {
      if (!itemIds.has(stock.itemExternalId)) {
        issues.push({
          severity: "WARNING",
          entity: "STOCK_LEVEL",
          field: "itemExternalId",
          code: "STOCK_ITEM_NOT_FOUND",
          message: `Stock level references unknown item ${stock.itemExternalId}`,
        });
      }
      if (!warehouseIds.has(stock.warehouseExternalId)) {
        issues.push({
          severity: "WARNING",
          entity: "STOCK_LEVEL",
          field: "warehouseExternalId",
          code: "STOCK_WAREHOUSE_NOT_FOUND",
          message: `Stock level references unknown warehouse ${stock.warehouseExternalId}`,
        });
      }
    }

    return {
      generatedAt: new Date().toISOString(),
      totals: {
        items: { rows: snapshot.items.length, errors: 0, warnings: 0 },
        warehouses: {
          rows: snapshot.warehouses.length,
          errors: 0,
          warnings: 0,
        },
      },
      issues,
    };
  },
};
