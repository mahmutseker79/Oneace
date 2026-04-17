/**
 * Phase E: QuickBooks Online OAuth 2.0 client.
 *
 * Handles OAuth flow, token management, and API calls to QuickBooks Online.
 * Uses the QBO V2 REST API with query-based reads and POST-based writes.
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

interface QBOItemRaw {
  Id?: string;
  Name?: string;
  Sku?: string;
  Description?: string;
  UnitPrice?: number;
  Type?: string;
  [key: string]: unknown;
}

interface QBOVendorRaw {
  Id?: string;
  DisplayName?: string;
  PrimaryEmailAddr?: { Address?: string };
  PrimaryPhone?: { FreeFormNumber?: string };
  BillAddr?: { CountrySubDivisionCode?: string };
  [key: string]: unknown;
}

interface QBOLineRaw {
  Id?: string;
  DetailType?: string;
  ItemBasedExpenseLineDetail?: { ItemRef?: { value?: string }; UnitPrice?: number };
  DescriptionOnlyLineDetail?: unknown;
  Qty?: number;
  [key: string]: unknown;
}

interface QBOPurchaseOrderRaw {
  Id?: string;
  DocNumber?: string;
  VendorRef?: { value?: string };
  TotalAmt?: number;
  DueDate?: string;
  Line?: QBOLineRaw[];
  [key: string]: unknown;
}

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
   * Fetch items from QuickBooks via the query endpoint.
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

      const items = (response.data.QueryResponse?.Item ?? []) as QBOItemRaw[];

      return items.map((item) => ({
        id: String(item.Id ?? ""),
        name: String(item.Name ?? ""),
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

      const vendors = (response.data.QueryResponse?.Vendor ?? []) as QBOVendorRaw[];

      return vendors.map((vendor) => ({
        id: String(vendor.Id ?? ""),
        name: String(vendor.DisplayName ?? ""),
        email: String(vendor.PrimaryEmailAddr?.Address ?? ""),
        phone: String(vendor.PrimaryPhone?.FreeFormNumber ?? ""),
        address: String(vendor.BillAddr?.CountrySubDivisionCode ?? ""),
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

      const orders = (response.data.QueryResponse?.PurchaseOrder ?? []) as QBOPurchaseOrderRaw[];

      return orders.map((order) => ({
        id: String(order.Id ?? ""),
        docNumber: String(order.DocNumber ?? ""),
        vendorId: String(order.VendorRef?.value ?? ""),
        amount: Number(order.TotalAmt ?? 0),
        dueDate: String(order.DueDate ?? ""),
        status: "OPEN" as const,
        lineItems: Array.isArray(order.Line)
          ? order.Line.map((line) => {
              const detailData =
                line.DetailType === "ItemBasedExpenseLineDetail"
                  ? (line.ItemBasedExpenseLineDetail as { ItemRef?: { value?: string }; UnitPrice?: number } | undefined)
                  : undefined;
              return {
                id: String(line.Id ?? ""),
                itemId: String(detailData?.ItemRef?.value ?? ""),
                quantity: Number(line.Qty ?? 0),
                unitPrice: Number(detailData?.UnitPrice ?? 0),
              };
            })
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

      const created = response.data.Item as QBOItemRaw;

      return {
        id: String(created.Id ?? ""),
        name: String(created.Name ?? ""),
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

      const updated = response.data.Item as QBOItemRaw;

      return {
        id: String(updated.Id ?? ""),
        name: String(updated.Name ?? ""),
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

      const created = response.data.Vendor as QBOVendorRaw;

      return {
        id: String(created.Id ?? ""),
        name: String(created.DisplayName ?? ""),
        email: String(created.PrimaryEmailAddr?.Address ?? ""),
        phone: String(created.PrimaryPhone?.FreeFormNumber ?? ""),
        address: String(created.BillAddr?.CountrySubDivisionCode ?? ""),
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
