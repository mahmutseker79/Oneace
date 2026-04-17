/**
 * Phase MIG-QBO — QuickBooks Online migration adapter.
 *
 * Implements MigrationAdapter for one-time snapshot import.
 * User can:
 *   1. Enter QBO OAuth credentials (new OAuth flow), OR
 *   2. "Use existing QBO connection" (reuses Integration row if already connected).
 *
 * The adapter fetches Items, Vendors, and Purchase Orders via API,
 * then parses them into the canonical Raw* format for the importer.
 */

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import type { MigrationAdapter, UploadedFile } from "@/lib/migrations/core/adapter";
import type { MigrationScopeOptions } from "@/lib/migrations/core/scope-options";
import {
  resolvePoHistoryCutoff,
  shouldImportPurchaseOrders,
} from "@/lib/migrations/core/scope-options";
import type {
  FieldMapping,
  FileDetectionResult,
  ParsedSnapshot,
  ValidationIssue,
  ValidationReport,
} from "@/lib/migrations/core/types";
import {
  QboMigrationClient,
  type QboMigrationCredentials,
} from "@/lib/migrations/quickbooks-online/api-client";
import { getQboDefaultMappings } from "@/lib/migrations/quickbooks-online/default-mappings";
import { parseQboSnapshot } from "@/lib/migrations/quickbooks-online/parser";
import { auditCredentialsDecrypted, readCredentials } from "@/lib/secure/credentials";

/**
 * Extract QBO credentials from fieldMappings.
 * Handles two modes:
 *   1. Direct credentials: { accessToken, refreshToken, expiresAt, realmId } (may be encrypted or plaintext)
 *   2. Existing integration: { useExistingIntegration: true, organizationId, ...}
 *
 * Auto-detects encrypted (EncryptedCredentials) vs plaintext via readCredentials.
 */
function extractQboCredentials(
  fieldMappings: Record<string, unknown>,
): QboMigrationCredentials | null {
  const creds = fieldMappings.credentials;

  if (!creds || typeof creds !== "object") {
    return null;
  }

  const c = creds as Record<string, unknown>;

  // Check if useExistingIntegration flag is set (will be resolved by adapter below)
  if (c.useExistingIntegration === true) {
    return {
      accessToken: "", // Placeholder; will be fetched from Integration row
      realmId: (c.realmId as string) || "",
    } as QboMigrationCredentials;
  }

  // Auto-detect encrypted or plaintext credentials
  const decrypted = readCredentials(creds);
  if (
    decrypted &&
    typeof decrypted.accessToken === "string" &&
    typeof decrypted.realmId === "string"
  ) {
    return {
      accessToken: decrypted.accessToken,
      refreshToken: decrypted.refreshToken ? String(decrypted.refreshToken) : undefined,
      expiresAt: decrypted.expiresAt ? Number(decrypted.expiresAt) : Date.now() + 3600 * 1000,
      realmId: decrypted.realmId,
    };
  }

  return null;
}

export const QBO_MIGRATION_ADAPTER: MigrationAdapter = {
  source: "QUICKBOOKS_ONLINE",
  method: "API",
  supportedFiles: [], // API-only; no file upload

  async detectFiles(): Promise<FileDetectionResult[]> {
    // No files to detect for API sources
    return [];
  },

  async parse(
    _files: UploadedFile[],
    fieldMappings?: Record<string, unknown>,
  ): Promise<ParsedSnapshot> {
    if (!fieldMappings) {
      throw new Error("QBO adapter requires credentials in fieldMappings");
    }

    const creds = extractQboCredentials(fieldMappings);
    if (!creds) {
      throw new Error(
        "QBO credentials (accessToken, realmId) not found in fieldMappings.credentials",
      );
    }

    if (!creds.realmId) {
      throw new Error("MISSING_REALM_ID: QBO migration requires a realmId");
    }

    // If useExistingIntegration was set, fetch the Integration row
    let finalCreds = creds;
    if ((fieldMappings.credentials as Record<string, unknown>)?.useExistingIntegration === true) {
      const orgId = (fieldMappings.credentials as Record<string, unknown>)
        ?.organizationId as string;
      const integration = await db.integration.findFirst({
        where: {
          organizationId: orgId,
          provider: "QUICKBOOKS_ONLINE",
          status: "CONNECTED",
        },
        select: { id: true, credentials: true },
      });

      if (!integration || !integration.credentials) {
        throw new Error("No connected QBO integration found for this organization");
      }

      // Auto-detect encrypted or plaintext credentials
      const storedCreds = readCredentials(integration.credentials);
      if (!storedCreds) {
        throw new Error("Integration credentials missing or malformed");
      }

      // Audit the decryption
      await auditCredentialsDecrypted({
        organizationId: orgId,
        integrationId: integration.id,
        reason: "import",
      });

      finalCreds = {
        accessToken: String(storedCreds.accessToken || ""),
        refreshToken: storedCreds.refreshToken ? String(storedCreds.refreshToken) : undefined,
        expiresAt: storedCreds.expiresAt ? Number(storedCreds.expiresAt) : Date.now() + 3600 * 1000,
        realmId: creds.realmId,
      };

      // Audit log the reuse
      logger.info("QBO migration using existing integration", {
        organizationId: orgId,
        realmId: creds.realmId,
        action: "migration.credentials.reused",
      });
    }

    const client = new QboMigrationClient(finalCreds);

    // Fetch all entities in parallel where possible
    const [items, vendors, purchaseOrders] = await Promise.all([
      client.listItems(),
      client.listVendors(),
      client.listPurchaseOrders(),
    ]);

    // Parse into canonical snapshot
    return parseQboSnapshot({
      items,
      vendors,
      purchaseOrders,
    });
  },

  /**
   * Parse with scope options (date filtering for POs, etc.).
   */
  async parseWithScope(
    files: UploadedFile[],
    fieldMappings: Record<string, unknown>,
    scope: MigrationScopeOptions,
  ): Promise<ParsedSnapshot> {
    if (!fieldMappings) {
      throw new Error("QBO adapter requires credentials in fieldMappings");
    }

    const creds = extractQboCredentials(fieldMappings);
    if (!creds) {
      throw new Error(
        "QBO credentials (accessToken, realmId) not found in fieldMappings.credentials",
      );
    }

    if (!creds.realmId) {
      throw new Error("MISSING_REALM_ID: QBO migration requires a realmId");
    }

    // Fetch existing integration if useExistingIntegration flag is set
    let finalCreds = creds;
    if ((fieldMappings.credentials as Record<string, unknown>)?.useExistingIntegration === true) {
      const orgId = (fieldMappings.credentials as Record<string, unknown>)
        ?.organizationId as string;
      const integration = await db.integration.findFirst({
        where: {
          organizationId: orgId,
          provider: "QUICKBOOKS_ONLINE",
          status: "CONNECTED",
        },
        select: { id: true, credentials: true },
      });

      if (!integration || !integration.credentials) {
        throw new Error("No connected QBO integration found for this organization");
      }

      // Auto-detect encrypted or plaintext credentials
      const storedCreds = readCredentials(integration.credentials);
      if (!storedCreds) {
        throw new Error("Integration credentials missing or malformed");
      }

      // Audit the decryption
      await auditCredentialsDecrypted({
        organizationId: orgId,
        integrationId: integration.id,
        reason: "import",
      });

      finalCreds = {
        accessToken: String(storedCreds.accessToken || ""),
        refreshToken: storedCreds.refreshToken ? String(storedCreds.refreshToken) : undefined,
        expiresAt: storedCreds.expiresAt ? Number(storedCreds.expiresAt) : Date.now() + 3600 * 1000,
        realmId: creds.realmId,
      };
    }

    const client = new QboMigrationClient(finalCreds);

    // Fetch items and vendors (always)
    const [items, vendors] = await Promise.all([client.listItems(), client.listVendors()]);

    // Fetch purchase orders respecting scope
    let purchaseOrders: any[] = [];
    if (shouldImportPurchaseOrders(scope)) {
      const cutoff = resolvePoHistoryCutoff(scope.poHistory);
      purchaseOrders = await client.listPurchaseOrders(cutoff ? { updatedAfter: cutoff } : {});

      // Filter by status if scope.poHistory === "OPEN_ONLY"
      if (scope.poHistory === "OPEN_ONLY") {
        const closedStatuses = ["RECEIVED", "CLOSED", "CANCELLED"];
        purchaseOrders = purchaseOrders.filter((po) => !closedStatuses.includes(String(po.status)));
      }
    }

    // Parse into canonical snapshot
    return parseQboSnapshot({
      items,
      vendors,
      purchaseOrders,
    });
  },

  suggestMappings(snapshot: ParsedSnapshot): FieldMapping[] {
    return getQboDefaultMappings(snapshot);
  },

  validate(snapshot: ParsedSnapshot, _mappings: FieldMapping[], scope: any): ValidationReport {
    const issues: ValidationIssue[] = [];

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

    // Validate warehouse references in stock levels
    const warehouseIds = new Set(snapshot.warehouses.map((w) => w.externalId));
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

      // Flag negative quantities (allowed but unusual)
      if (stock.quantity < 0) {
        issues.push({
          severity: "WARNING",
          entity: "STOCK_LEVEL",
          externalId: stock.itemExternalId,
          field: "quantity",
          code: "NEGATIVE_STOCK",
          message: `Item has negative stock (${stock.quantity}); check if this is intentional`,
        });
      }
    }

    // Validate PO supplier references
    const supplierIds = new Set(snapshot.suppliers.map((s) => s.externalId));
    for (const po of snapshot.purchaseOrders) {
      if (!supplierIds.has(po.supplierExternalId)) {
        issues.push({
          severity: "WARNING",
          entity: "PURCHASE_ORDER",
          externalId: po.externalId,
          field: "supplierExternalId",
          code: "PO_SUPPLIER_NOT_FOUND",
          message: `PO references unknown supplier ${po.supplierExternalId}`,
        });
      }

      // Validate PO line items reference existing items
      for (const line of po.lines) {
        if (!itemIds.has(line.itemExternalId)) {
          issues.push({
            severity: "WARNING",
            entity: "PURCHASE_ORDER",
            externalId: po.externalId,
            field: "lines.itemExternalId",
            code: "PO_ITEM_NOT_FOUND",
            message: `PO line references unknown item ${line.itemExternalId}`,
          });
        }
      }
    }

    return {
      generatedAt: new Date().toISOString(),
      totals: {
        items: {
          rows: snapshot.items.length,
          errors: issues.filter((i) => i.entity === "ITEM" && i.severity === "ERROR").length,
          warnings: 0,
        },
        suppliers: {
          rows: snapshot.suppliers.length,
          errors: 0,
          warnings: 0,
        },
        purchaseOrders: {
          rows: snapshot.purchaseOrders.length,
          errors: 0,
          warnings: 0,
        },
      },
      issues,
    };
  },
};
