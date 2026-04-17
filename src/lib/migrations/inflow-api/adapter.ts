/**
 * Phase MIG-S5 — inFlow API mode adapter (dispatcher).
 *
 * inFlow has two import modes:
 * 1. CSV mode (existing adapter) — user uploads CSV files
 * 2. API mode (this adapter) — user provides API credentials
 *
 * This adapter checks fieldMappings.credentials:
 * - If present → use API mode (delegate to InflowApiClient)
 * - If absent → this adapter fails; the CSV adapter handles the import
 *
 * The MigrationJob orchestrator picks the right adapter based on
 * whether the user chose "Upload files" or "Enter API credentials".
 */

import type { MigrationAdapter } from "@/lib/migrations/core/adapter";
import type { MigrationScopeOptions } from "@/lib/migrations/core/scope-options";
import {
  resolvePoHistoryCutoff,
  shouldImportPurchaseOrders,
} from "@/lib/migrations/core/scope-options";
import type {
  FieldMapping,
  FileDetectionResult,
  ParsedSnapshot,
  ValidationReport,
} from "@/lib/migrations/core/types";
import { InflowApiClient, type InflowCredentials } from "@/lib/migrations/inflow-api/api-client";
import { getInflowApiDefaultMappings } from "@/lib/migrations/inflow-api/default-mappings";
import { parseInflowApiSnapshot } from "@/lib/migrations/inflow-api/parser";
import { readCredentials } from "@/lib/secure/credentials";

function extractInflowCredentials(
  fieldMappings: Record<string, unknown>,
): InflowCredentials | null {
  const creds = fieldMappings.credentials;
  if (!creds || typeof creds !== "object") {
    return null;
  }

  // Auto-detect encrypted or plaintext credentials
  const decrypted = readCredentials(creds);
  if (
    decrypted &&
    "apiToken" in decrypted &&
    "companyId" in decrypted &&
    typeof decrypted.apiToken === "string" &&
    typeof decrypted.companyId === "string"
  ) {
    return {
      apiToken: decrypted.apiToken,
      companyId: decrypted.companyId,
    };
  }

  return null;
}

export const INFLOW_API_ADAPTER: MigrationAdapter = {
  source: "INFLOW",
  method: "API",
  supportedFiles: [], // API mode; CSV mode is separate

  async detectFiles(): Promise<FileDetectionResult[]> {
    return [];
  },

  async parse(_files, fieldMappings?: Record<string, unknown>): Promise<ParsedSnapshot> {
    if (!fieldMappings) {
      throw new Error("inFlow API adapter requires credentials in fieldMappings");
    }

    const creds = extractInflowCredentials(fieldMappings);
    if (!creds) {
      throw new Error(
        "inFlow API credentials (apiToken, companyId) not found in fieldMappings.credentials",
      );
    }

    const client = new InflowApiClient(creds);

    // Fetch all entities in parallel
    const [products, vendors, locations, stockLevels, purchaseOrders] = await Promise.all([
      client.getAllProducts(),
      client.getAllVendors(),
      client.getAllLocations(),
      client.getAllStockLevels(),
      client.getAllPurchaseOrders(),
    ]);

    return parseInflowApiSnapshot({
      products,
      vendors,
      locations,
      stockLevels,
      purchaseOrders,
    });
  },

  /**
   * Parse with scope options (date filtering for POs).
   */
  async parseWithScope(
    _files,
    fieldMappings: Record<string, unknown>,
    scope: MigrationScopeOptions,
  ): Promise<ParsedSnapshot> {
    if (!fieldMappings) {
      throw new Error("inFlow API adapter requires credentials in fieldMappings");
    }

    const creds = extractInflowCredentials(fieldMappings);
    if (!creds) {
      throw new Error(
        "inFlow API credentials (apiToken, companyId) not found in fieldMappings.credentials",
      );
    }

    const client = new InflowApiClient(creds);

    // Fetch all entities
    const [products, vendors, locations, stockLevels] = await Promise.all([
      client.getAllProducts(),
      client.getAllVendors(),
      client.getAllLocations(),
      client.getAllStockLevels(),
    ]);

    // Fetch purchase orders respecting scope
    let purchaseOrders: any[] = [];
    if (shouldImportPurchaseOrders(scope)) {
      const cutoff = resolvePoHistoryCutoff(scope.poHistory);
      purchaseOrders = await client.getAllPurchaseOrders(cutoff ?? undefined);

      // Filter by status if OPEN_ONLY
      if (scope.poHistory === "OPEN_ONLY") {
        const closedStatuses = ["RECEIVED", "CLOSED", "CANCELLED"];
        purchaseOrders = purchaseOrders.filter((po) => !closedStatuses.includes(String(po.status)));
      }
    }

    return parseInflowApiSnapshot({
      products,
      vendors,
      locations,
      stockLevels,
      purchaseOrders,
    });
  },

  suggestMappings(snapshot: ParsedSnapshot): FieldMapping[] {
    return getInflowApiDefaultMappings(snapshot);
  },

  validate(snapshot: ParsedSnapshot, _mappings: FieldMapping[], _scope: any): ValidationReport {
    const issues: any[] = [];

    // Validate all products have SKU
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

    // Validate warehouse references
    const warehouseIds = new Set(snapshot.warehouses.map((w) => w.externalId));
    for (const stock of snapshot.stockLevels) {
      if (!warehouseIds.has(stock.warehouseExternalId)) {
        issues.push({
          severity: "WARNING",
          entity: "STOCK_LEVEL",
          field: "warehouseExternalId",
          code: "STOCK_WAREHOUSE_NOT_FOUND",
          message: `Stock level references unknown location ${stock.warehouseExternalId}`,
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
