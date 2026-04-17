/**
 * Phase MIG-S5 — SOS Inventory REST API adapter.
 *
 * SOS is an API-only source with OAuth 2.0 authentication.
 * Credentials are stored on MigrationJob.fieldMappings.credentials.
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
  SOSApiClient,
  type SOSCredentials,
} from "@/lib/migrations/sos-inventory/api-client";
import { getSOSDefaultMappings } from "@/lib/migrations/sos-inventory/default-mappings";
import { parseSOSSnapshot } from "@/lib/migrations/sos-inventory/parser";

function extractSOSCredentials(
  fieldMappings: Record<string, unknown>,
): SOSCredentials | null {
  const creds = fieldMappings.credentials;
  if (
    creds &&
    typeof creds === "object" &&
    "accessToken" in creds &&
    "refreshToken" in creds &&
    "clientId" in creds &&
    "clientSecret" in creds &&
    "realmId" in creds
  ) {
    const c = creds as Record<string, unknown>;
    if (
      typeof c.accessToken === "string" &&
      typeof c.refreshToken === "string" &&
      typeof c.clientId === "string" &&
      typeof c.clientSecret === "string" &&
      typeof c.realmId === "string"
    ) {
      return {
        accessToken: c.accessToken,
        refreshToken: c.refreshToken,
        clientId: c.clientId,
        clientSecret: c.clientSecret,
        realmId: c.realmId,
      };
    }
  }
  return null;
}

export const SOS_INVENTORY_ADAPTER: MigrationAdapter = {
  source: "SOS_INVENTORY",
  method: "API",
  supportedFiles: [], // API-only

  async detectFiles(): Promise<FileDetectionResult[]> {
    return [];
  },

  async parse(
    _files,
    fieldMappings?: Record<string, unknown>,
  ): Promise<ParsedSnapshot> {
    if (!fieldMappings) {
      throw new Error(
        "SOS Inventory adapter requires credentials in fieldMappings",
      );
    }

    const creds = extractSOSCredentials(fieldMappings);
    if (!creds) {
      throw new Error(
        "SOS Inventory credentials not found in fieldMappings.credentials",
      );
    }

    const client = new SOSApiClient(creds);

    // Fetch all entities in parallel
    const [items, vendors, locations, inventoryLocations, purchaseOrders] =
      await Promise.all([
        client.getAllItems(),
        client.getAllVendors(),
        client.getAllLocations(),
        client.getAllInventoryLocations(),
        client.getAllPurchaseOrders(),
      ]);

    return parseSOSSnapshot({
      items,
      vendors,
      locations,
      inventoryLocations,
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
      throw new Error(
        "SOS Inventory adapter requires credentials in fieldMappings",
      );
    }

    const creds = extractSOSCredentials(fieldMappings);
    if (!creds) {
      throw new Error(
        "SOS Inventory credentials not found in fieldMappings.credentials",
      );
    }

    const client = new SOSApiClient(creds);

    const [items, vendors, locations, inventoryLocations] = await Promise.all([
      client.getAllItems(),
      client.getAllVendors(),
      client.getAllLocations(),
      client.getAllInventoryLocations(),
    ]);

    // Fetch purchase orders respecting scope
    let purchaseOrders: any[] = [];
    if (shouldImportPurchaseOrders(scope)) {
      const cutoff = resolvePoHistoryCutoff(scope.poHistory);
      purchaseOrders = await client.getAllPurchaseOrders(cutoff ?? undefined);

      // Filter by status if OPEN_ONLY
      if (scope.poHistory === "OPEN_ONLY") {
        const closedStatuses = ["RECEIVED", "CLOSED", "CANCELLED"];
        purchaseOrders = purchaseOrders.filter(
          (po) => !closedStatuses.includes(String(po.status)),
        );
      }
    }

    return parseSOSSnapshot({
      items,
      vendors,
      locations,
      inventoryLocations,
      purchaseOrders,
    });
  },

  suggestMappings(snapshot: ParsedSnapshot): FieldMapping[] {
    return getSOSDefaultMappings(snapshot);
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

    // SOS is QuickBooks-native: check for SKU collisions
    // with existing items in the database (warning, not error)
    // This would be handled by the orchestrator with a DB query
    // For now, we just note it in warnings
    if (snapshot.items.length > 0) {
      issues.push({
        severity: "WARNING",
        entity: "ITEM",
        code: "POSSIBLE_QBO_DUP",
        message: `SOS Inventory is QuickBooks-native. Check for SKU collisions with existing QBO Items in your account.`,
      });
    }

    // Validate warehouse references
    const warehouseIds = new Set(
      snapshot.warehouses.map((w) => w.externalId),
    );
    for (const stock of snapshot.stockLevels) {
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
