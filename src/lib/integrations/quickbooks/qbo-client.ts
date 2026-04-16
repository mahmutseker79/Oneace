/**
 * Phase E: QuickBooks Online OAuth 2.0 client.
 *
 * Handles OAuth flow, token management, and API calls to QuickBooks Online.
 * Actual API implementations are placeholder - full implementation would call
 * the actual QBO API endpoints.
 */

import {
  IntegrationClient,
  type OAuthConfig,
  type OAuthToken,
} from "@/lib/integrations/base-client";
import { logger } from "@/lib/logger";

const QBO_OAUTH_CONFIG: OAuthConfig = {
  clientId: process.env.QBO_CLIENT_ID || "",
  clientSecret: process.env.QBO_CLIENT_SECRET || "",
  redirectUri: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/integrations/quickbooks/callback`,
  authorizationUrl: "https://appcenter.intuit.com/connect/oauth2",
  tokenUrl: "https://oauth.platform.intuit.com/oauth2/tokens",
  revokeUrl: "https://developer.api.intuit.com/v2/oauth/tokens/revoke",
};

export interface QBOItem {
  id: string;
  name: string;
  sku?: string;
  description?: string;
  unitPrice?: number;
  type: "SERVICE" | "PRODUCT";
}

export interface QBOSupplier {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface QBOPurchaseOrder {
  id: string;
  docNumber: string;
  vendorId: string;
  amount: number;
  dueDate?: string;
  status: "DRAFT" | "OPEN" | "CLOSED";
  lineItems: Array<{
    id: string;
    itemId: string;
    quantity: number;
    unitPrice: number;
  }>;
}

/**
 * QuickBooks Online integration client.
 */
export class QBOClient extends IntegrationClient {
  private realmId = "";

  constructor(credentials: OAuthToken, realmId: string) {
    super(QBO_OAUTH_CONFIG, credentials);
    this.realmId = realmId;
    this.baseUrl = `https://quickbooks.api.intuit.com/v2/company/${realmId}`;
  }

  /**
   * Get the authorization URL for OAuth flow.
   */
  getAuthorizationUrl(state: string): string {
    return super.getAuthorizationUrl(state, ["com.intuit.quickbooks.accounting"]);
  }

  /**
   * Fetch items from QuickBooks.
   * Placeholder - actual implementation would query the Item endpoint.
   */
  async getItems(limit = 100): Promise<QBOItem[]> {
    try {
      const response = await this.apiCall<{
        QueryResponse: { Item?: Array<Record<string, unknown>> };
      }>("/query", {
        params: {
          query: `SELECT * FROM Item MAXRESULTS ${limit}`,
        },
      });

      const items = response.data.QueryResponse?.Item ?? [];

      return items.map((item) => ({
        id: String(item.Id),
        name: String(item.Name),
        sku: String(item.Sku ?? ""),
        description: String(item.Description ?? ""),
        unitPrice: Number(item.UnitPrice ?? 0),
        type: item.Type === "Service" ? "SERVICE" : "PRODUCT",
      }));
    } catch (error) {
      logger.error("Failed to fetch QBO items", { error });
      throw error;
    }
  }

  /**
   * Fetch vendors (suppliers) from QuickBooks.
   */
  async getVendors(limit = 100): Promise<QBOSupplier[]> {
    try {
      const response = await this.apiCall<{
        QueryResponse: { Vendor?: Array<Record<string, unknown>> };
      }>("/query", {
        params: {
          query: `SELECT * FROM Vendor MAXRESULTS ${limit}`,
        },
      });

      const vendors = response.data.QueryResponse?.Vendor ?? [];

      return vendors.map((vendor: any) => ({
        id: String(vendor.Id),
        name: String(vendor.DisplayName),
        email: String((vendor.PrimaryEmailAddr as any)?.Address ?? ""),
        phone: String((vendor.PrimaryPhone as any)?.FreeFormNumber ?? ""),
        address: String((vendor.BillAddr as any)?.CountrySubDivisionCode ?? ""),
      }));
    } catch (error) {
      logger.error("Failed to fetch QBO vendors", { error });
      throw error;
    }
  }

  /**
   * Fetch purchase orders from QuickBooks.
   */
  async getPurchaseOrders(limit = 100, updatedAfter?: Date): Promise<QBOPurchaseOrder[]> {
    try {
      let query = `SELECT * FROM PurchaseOrder MAXRESULTS ${limit}`;

      if (updatedAfter) {
        const dateStr = updatedAfter.toISOString().split("T")[0];
        query += ` WHERE MetaData.UpdatedTime >= '${dateStr}'`;
      }

      const response = await this.apiCall<{
        QueryResponse: {
          PurchaseOrder?: Array<Record<string, unknown>>;
        };
      }>("/query", {
        params: { query },
      });

      const orders = response.data.QueryResponse?.PurchaseOrder ?? [];

      return orders.map((order: any) => ({
        id: String(order.Id),
        docNumber: String(order.DocNumber),
        vendorId: String((order.VendorRef as any)?.value ?? ""),
        amount: Number(order.TotalAmt ?? 0),
        dueDate: String(order.DueDate ?? ""),
        status: "OPEN",
        lineItems: Array.isArray(order.Line)
          ? order.Line.map((line: Record<string, unknown>) => ({
              id: String(line.Id),
              itemId: String(
                (
                  (line.DetailType === "ItemBasedExpenseLineDetail"
                    ? (line.ItemBasedExpenseLineDetail as any)
                    : (line.DescriptionOnlyLineDetail as any)) as any
                )?.ItemRef?.value ?? "",
              ),
              quantity: Number(line.Qty ?? 0),
              unitPrice: Number(
                (
                  (line.DetailType === "ItemBasedExpenseLineDetail"
                    ? (line.ItemBasedExpenseLineDetail as any)
                    : (line.DescriptionOnlyLineDetail as any)) as any
                )?.UnitPrice ?? 0,
              ),
            }))
          : [],
      }));
    } catch (error) {
      logger.error("Failed to fetch QBO purchase orders", { error });
      throw error;
    }
  }

  /**
   * Create an item in QuickBooks.
   */
  async createItem(item: Partial<QBOItem>): Promise<QBOItem> {
    try {
      const payload = {
        Name: item.name,
        Sku: item.sku,
        Description: item.description,
        Type: item.type === "SERVICE" ? "Service" : "Product",
        UnitPrice: item.unitPrice,
      };

      const response = await this.apiCall<{ Item: Record<string, unknown> }>("/item", {
        method: "POST",
        body: payload,
      });

      const created = response.data.Item;

      return {
        id: String(created.Id),
        name: String(created.Name),
        sku: String(created.Sku ?? ""),
        description: String(created.Description ?? ""),
        unitPrice: Number(created.UnitPrice ?? 0),
        type: created.Type === "Service" ? "SERVICE" : "PRODUCT",
      };
    } catch (error) {
      logger.error("Failed to create QBO item", { error });
      throw error;
    }
  }

  /**
   * Update an item in QuickBooks.
   */
  async updateItem(id: string, updates: Partial<QBOItem>): Promise<QBOItem> {
    try {
      const payload = {
        Id: id,
        Name: updates.name,
        Sku: updates.sku,
        Description: updates.description,
        Type: updates.type === "SERVICE" ? "Service" : "Product",
        UnitPrice: updates.unitPrice,
      };

      const response = await this.apiCall<{ Item: Record<string, unknown> }>(`/item/${id}`, {
        method: "POST",
        body: payload,
      });

      const updated = response.data.Item;

      return {
        id: String(updated.Id),
        name: String(updated.Name),
        sku: String(updated.Sku ?? ""),
        description: String(updated.Description ?? ""),
        unitPrice: Number(updated.UnitPrice ?? 0),
        type: updated.Type === "Service" ? "SERVICE" : "PRODUCT",
      };
    } catch (error) {
      logger.error("Failed to update QBO item", { error });
      throw error;
    }
  }

  /**
   * Create a vendor in QuickBooks.
   */
  async createVendor(supplier: Partial<QBOSupplier>): Promise<QBOSupplier> {
    try {
      const payload = {
        DisplayName: supplier.name,
        PrimaryEmailAddr: supplier.email ? { Address: supplier.email } : undefined,
        PrimaryPhone: supplier.phone ? { FreeFormNumber: supplier.phone } : undefined,
        BillAddr: supplier.address ? { CountrySubDivisionCode: supplier.address } : undefined,
      };

      const response = await this.apiCall<{
        Vendor: Record<string, unknown>;
      }>("/vendor", {
        method: "POST",
        body: payload,
      });

      const created = response.data.Vendor;

      return {
        id: String(created.Id),
        name: String(created.DisplayName),
        email: String((created.PrimaryEmailAddr as any)?.Address ?? ""),
        phone: String((created.PrimaryPhone as any)?.FreeFormNumber ?? ""),
        address: String((created.BillAddr as any)?.CountrySubDivisionCode ?? ""),
      };
    } catch (error) {
      logger.error("Failed to create QBO vendor", { error });
      throw error;
    }
  }

  /**
   * Get QuickBooks company info (e.g., for validating connection).
   */
  async getCompanyInfo(): Promise<Record<string, unknown>> {
    try {
      const response = await this.apiCall<{
        CompanyInfo: Record<string, unknown>;
      }>(`/companyinfo/${this.realmId}`);

      return response.data.CompanyInfo;
    } catch (error) {
      logger.error("Failed to fetch QBO company info", { error });
      throw error;
    }
  }

  /**
   * Set the realm ID (company ID in QBO terms).
   */
  setRealmId(realmId: string): void {
    this.realmId = realmId;
    this.baseUrl = `https://quickbooks.api.intuit.com/v2/company/${realmId}`;
  }

  /**
   * Get the current realm ID.
   */
  getRealmId(): string {
    return this.realmId;
  }
}

export default QBOClient;
