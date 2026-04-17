/**
 * Phase MIG-QBO — QuickBooks Online Migration Client (thin wrapper).
 *
 * This client is a lightweight adapter over the existing qbo-client.ts.
 * It reuses OAuth token refresh, rate limiting, and HTTP helpers from the
 * live QBO integration rather than reimplementing them.
 *
 * Purpose: migrate data ONE-TIME from QBO (snapshot import).
 * Does NOT replace the live sync engine (qbo-sync.ts).
 */

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { QBOClient, type QBOItem, type QBOVendor, type QBOPurchaseOrder } from "@/lib/integrations/quickbooks/qbo-client";
import type { OAuthToken } from "@/lib/integrations/base-client";

export interface QboMigrationCredentials {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  realmId: string;
  clientId?: string;
  clientSecret?: string;
  useExistingIntegration?: boolean;
}

/**
 * Thin wrapper over QBOClient for migration purposes.
 * Delegates all OAuth and HTTP logic to the existing client.
 */
export class QboMigrationClient {
  private client: QBOClient;
  private realmId: string;

  constructor(credentials: QboMigrationCredentials) {
    if (!credentials.realmId) {
      throw new Error("MISSING_REALM_ID: QBO migration requires a realmId");
    }

    this.realmId = credentials.realmId;

    // Wrap credentials in OAuthToken format (what QBOClient expects)
    const oauthToken: OAuthToken = {
      accessToken: credentials.accessToken,
      refreshToken: credentials.refreshToken,
      expiresAt: credentials.expiresAt,
    };

    // Create the client and pass the realmId
    this.client = new QBOClient(oauthToken, credentials.realmId);
  }

  /**
   * Fetch all Items with optional paging.
   * Respects rate limiting from the underlying client.
   */
  async listItems(opts: { updatedAfter?: Date } = {}): Promise<QBOItem[]> {
    try {
      return await this.client.getAllItems(opts.updatedAfter);
    } catch (error) {
      logger.error("QBO migration: getAllItems failed", { error });
      throw error;
    }
  }

  /**
   * Fetch all Vendors.
   */
  async listVendors(opts: { updatedAfter?: Date } = {}): Promise<QBOVendor[]> {
    try {
      return await this.client.getAllVendors(opts.updatedAfter);
    } catch (error) {
      logger.error("QBO migration: getAllVendors failed", { error });
      throw error;
    }
  }

  /**
   * Fetch all Purchase Orders.
   * Respects date filtering and scope options via caller.
   */
  async listPurchaseOrders(opts: { updatedAfter?: Date } = {}): Promise<QBOPurchaseOrder[]> {
    try {
      return await this.client.getAllPurchaseOrders(opts.updatedAfter);
    } catch (error) {
      logger.error("QBO migration: getAllPurchaseOrders failed", { error });
      throw error;
    }
  }

  /**
   * Fetch all Accounts (Chart of Accounts).
   * Used to resolve inventory asset mapping.
   * Mostly ignored for item migration, but required for validation.
   */
  async listAccounts(): Promise<any[]> {
    try {
      return await this.client.getAllAccounts();
    } catch (error) {
      logger.error("QBO migration: getAllAccounts failed", { error });
      throw error;
    }
  }

  /**
   * Get realmId for auditing/logging.
   */
  getRealmId(): string {
    return this.realmId;
  }

  /**
   * Optional: fetch attachable entities by parent entity.
   * QBO Attachable API requires a separate call per entity.
   * Deferred for this sprint — would need a dedicated endpoint.
   *
   * TODO: implement in a future sprint if scope.includeAttachments && entity is Item
   */
  async listAttachablesByEntity(entityId: string, entityType: string): Promise<any[]> {
    logger.warn("QBO attachments not yet implemented for migration", { entityId, entityType });
    return [];
  }
}
