/**
 * Zoho Inventory API v1 Integration Client
 *
 * Zoho Inventory provides APIs for:
 * - Items
 * - Composite Items
 * - Item Groups
 * - Sales Orders
 * - Purchase Orders
 * - Invoices
 * - Bills
 * - Contacts
 * - Packages
 * - Shipments
 * - Inventory Adjustments
 * - Transfer Orders
 * - Warehouses
 * - Taxes
 * - Currencies
 *
 * Auth: OAuth 2.0 (auth URL: https://accounts.zoho.com/oauth/v2/auth, token URL: https://accounts.zoho.com/oauth/v2/token)
 * Rate limit: 100 req/min
 * organization_id in header
 */

import IntegrationClient, {
  type OAuthConfig,
  type OAuthToken,
  type RateLimitConfig,
  type ApiCallOptions,
} from "@/lib/integrations/base-client";
import { logger } from "@/lib/logger";

export interface ZohoItem {
  item_id: string;
  name: string;
  sku?: string;
  description?: string;
  item_type?: string;
  rate?: number;
  tax_id?: string;
  account_id?: string;
  inventory_account_id?: string;
  cost?: number;
  quantity_on_hand?: number;
  reorder_level?: number;
  reorder_quantity?: number;
  item_group_id?: string;
  warehouse_id?: string;
}

export interface ZohoSalesOrder {
  salesorder_id: string;
  order_number: string;
  customer_id: string;
  reference_number?: string;
  line_items?: Array<{
    line_item_id: string;
    item_id: string;
    quantity: number;
    item_price: number;
  }>;
  status?: string;
  total?: number;
  date?: string;
}

export interface ZohoPurchaseOrder {
  purchaseorder_id: string;
  purchaseorder_number: string;
  vendor_id: string;
  reference_number?: string;
  line_items?: Array<{
    line_item_id: string;
    item_id: string;
    quantity: number;
    unit_price: number;
  }>;
  status?: string;
  total?: number;
  expected_delivery_date?: string;
}

export interface ZohoContact {
  contact_id: string;
  contact_name: string;
  contact_type?: string;
  company_name?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  billing_address?: {
    address: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  shipping_address?: {
    address: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
}

export interface ZohoInvoice {
  invoice_id: string;
  invoice_number: string;
  customer_id: string;
  line_items?: Array<{
    line_item_id: string;
    item_id: string;
    quantity: number;
    item_price: number;
  }>;
  status?: string;
  total?: number;
  invoice_date?: string;
}

export interface ZohoBill {
  bill_id: string;
  bill_number: string;
  vendor_id: string;
  line_items?: Array<{
    line_item_id: string;
    item_id: string;
    quantity: number;
    unit_price: number;
  }>;
  status?: string;
  total?: number;
  bill_date?: string;
}

export interface ZohoInventoryAdjustment {
  adjustment_id: string;
  adjustment_type?: string;
  line_items?: Array<{
    line_item_id: string;
    item_id: string;
    warehouse_id: string;
    quantity_adjusted: number;
  }>;
  reference_number?: string;
  adjustment_date?: string;
}

class ZohoClient extends IntegrationClient {
  private organizationId: string = "";

  constructor(
    oauthConfig: OAuthConfig,
    credentials: OAuthToken,
    organizationId: string,
    rateLimitConfig?: RateLimitConfig,
  ) {
    super(
      oauthConfig,
      credentials,
      rateLimitConfig || {
        maxRequests: 100,
        windowMs: 60000,
        backoffMultiplier: 2,
        maxBackoffMs: 32000,
      },
    );
    this.baseUrl = "https://www.zohoapis.com/inventory/v1";
    this.organizationId = organizationId;
  }

  /**
   * Build request headers with Zoho-specific authentication.
   */
  protected async getRequestHeaders(
    customHeaders?: Record<string, string>,
  ): Promise<Record<string, string>> {
    const baseHeaders = await super.getRequestHeaders(customHeaders);

    return {
      ...baseHeaders,
      "X-com-zoho-inventory-organizationid": this.organizationId,
    };
  }

  /**
   * Get items from Zoho Inventory.
   */
  async getItems(limit: number = 100, offset: number = 0): Promise<ZohoItem[]> {
    try {
      const response = await this.apiCall<{
        code: number;
        message: string;
        items?: ZohoItem[];
      }>("/items", {
        method: "GET",
        params: {
          limit,
          offset,
        },
      });

      return response.data.items || [];
    } catch (error) {
      logger.error("Failed to fetch Zoho items", { error });
      throw error;
    }
  }

  /**
   * Get a single item by ID.
   */
  async getItem(itemId: string): Promise<ZohoItem | null> {
    try {
      const response = await this.apiCall<{ code: number; item?: ZohoItem }>(`/items/${itemId}`, {
        method: "GET",
      });

      return response.data.item || null;
    } catch (error) {
      logger.error("Failed to fetch Zoho item", { itemId, error });
      return null;
    }
  }

  /**
   * Create an item in Zoho Inventory.
   */
  async createItem(item: Partial<ZohoItem>): Promise<ZohoItem> {
    try {
      const response = await this.apiCall<{ code: number; item?: ZohoItem }>("/items", {
        method: "POST",
        body: {
          item,
        },
      });

      if (!response.data.item) {
        throw new Error("No item returned from creation");
      }

      return response.data.item;
    } catch (error) {
      logger.error("Failed to create Zoho item", { item, error });
      throw error;
    }
  }

  /**
   * Update an item in Zoho Inventory.
   */
  async updateItem(itemId: string, item: Partial<ZohoItem>): Promise<ZohoItem> {
    try {
      const response = await this.apiCall<{ code: number; item?: ZohoItem }>(
        `/items/${itemId}`,
        {
          method: "PUT",
          body: {
            item,
          },
        },
      );

      if (!response.data.item) {
        throw new Error("No item returned from update");
      }

      return response.data.item;
    } catch (error) {
      logger.error("Failed to update Zoho item", { itemId, error });
      throw error;
    }
  }

  /**
   * Get sales orders from Zoho.
   */
  async getSalesOrders(limit: number = 100, offset: number = 0): Promise<ZohoSalesOrder[]> {
    try {
      const response = await this.apiCall<{
        code: number;
        salesorders?: ZohoSalesOrder[];
      }>("/salesorders", {
        method: "GET",
        params: {
          limit,
          offset,
        },
      });

      return response.data.salesorders || [];
    } catch (error) {
      logger.error("Failed to fetch Zoho sales orders", { error });
      throw error;
    }
  }

  /**
   * Get a single sales order by ID.
   */
  async getSalesOrder(soId: string): Promise<ZohoSalesOrder | null> {
    try {
      const response = await this.apiCall<{ code: number; salesorder?: ZohoSalesOrder }>(
        `/salesorders/${soId}`,
        {
          method: "GET",
        },
      );

      return response.data.salesorder || null;
    } catch (error) {
      logger.error("Failed to fetch Zoho sales order", { soId, error });
      return null;
    }
  }

  /**
   * Get purchase orders from Zoho.
   */
  async getPurchaseOrders(limit: number = 100, offset: number = 0): Promise<ZohoPurchaseOrder[]> {
    try {
      const response = await this.apiCall<{
        code: number;
        purchaseorders?: ZohoPurchaseOrder[];
      }>("/purchaseorders", {
        method: "GET",
        params: {
          limit,
          offset,
        },
      });

      return response.data.purchaseorders || [];
    } catch (error) {
      logger.error("Failed to fetch Zoho purchase orders", { error });
      throw error;
    }
  }

  /**
   * Get invoices from Zoho.
   */
  async getInvoices(limit: number = 100, offset: number = 0): Promise<ZohoInvoice[]> {
    try {
      const response = await this.apiCall<{
        code: number;
        invoices?: ZohoInvoice[];
      }>("/invoices", {
        method: "GET",
        params: {
          limit,
          offset,
        },
      });

      return response.data.invoices || [];
    } catch (error) {
      logger.error("Failed to fetch Zoho invoices", { error });
      throw error;
    }
  }

  /**
   * Get bills from Zoho.
   */
  async getBills(limit: number = 100, offset: number = 0): Promise<ZohoBill[]> {
    try {
      const response = await this.apiCall<{
        code: number;
        bills?: ZohoBill[];
      }>("/bills", {
        method: "GET",
        params: {
          limit,
          offset,
        },
      });

      return response.data.bills || [];
    } catch (error) {
      logger.error("Failed to fetch Zoho bills", { error });
      throw error;
    }
  }

  /**
   * Get contacts from Zoho.
   */
  async getContacts(limit: number = 100, offset: number = 0): Promise<ZohoContact[]> {
    try {
      const response = await this.apiCall<{
        code: number;
        contacts?: ZohoContact[];
      }>("/contacts", {
        method: "GET",
        params: {
          limit,
          offset,
        },
      });

      return response.data.contacts || [];
    } catch (error) {
      logger.error("Failed to fetch Zoho contacts", { error });
      throw error;
    }
  }

  /**
   * Get inventory adjustments from Zoho.
   */
  async getInventoryAdjustments(
    limit: number = 100,
    offset: number = 0,
  ): Promise<ZohoInventoryAdjustment[]> {
    try {
      const response = await this.apiCall<{
        code: number;
        adjustments?: ZohoInventoryAdjustment[];
      }>("/inventoryadjustments", {
        method: "GET",
        params: {
          limit,
          offset,
        },
      });

      return response.data.adjustments || [];
    } catch (error) {
      logger.error("Failed to fetch Zoho inventory adjustments", { error });
      throw error;
    }
  }
}

export default ZohoClient;
