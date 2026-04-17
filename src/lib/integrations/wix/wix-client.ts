/**
 * Wix REST API Integration Client
 *
 * Wix provides REST APIs for:
 * - Products (Wix Stores)
 * - Collections
 * - Orders
 * - Inventory
 * - Contacts
 * - Coupons
 * - Shipping
 * - Payments
 *
 * Auth: OAuth 2.0 (auth URL: https://www.wix.com/installer/install, token URL: https://www.wixapis.com/oauth/access)
 * Rate limit: 120 req/min per site
 */

import IntegrationClient, {
  type OAuthConfig,
  type OAuthToken,
  type RateLimitConfig,
  type ApiCallOptions,
  type ApiResponse,
} from "@/lib/integrations/base-client";
import { logger } from "@/lib/logger";

export interface WixProduct {
  id: string;
  name: string;
  description?: string;
  sku?: string;
  price?: number;
  currency?: string;
  stock?: number;
  productType?: string;
  collections?: string[];
}

export interface WixOrder {
  id: string;
  number: string;
  createdDate: string;
  lineItems: Array<{
    id: string;
    productId: string;
    quantity: number;
    price: number;
  }>;
  buyerInfo?: {
    contactId: string;
    email?: string;
    firstName?: string;
    lastName?: string;
  };
  totals?: {
    subtotal?: string;
    tax?: string;
    shipping?: string;
    total?: string;
  };
  status?: string;
}

export interface WixInventory {
  id: string;
  productId: string;
  quantity: number;
  lastModified: string;
}

export interface WixContact {
  id: string;
  firstName?: string;
  lastName?: string;
  emails?: Array<{ email: string; primary?: boolean }>;
  phones?: Array<{ phone: string; primary?: boolean }>;
  addresses?: Array<{
    address?: { city?: string; country?: string; postalCode?: string; state?: string; street?: string };
  }>;
}

class WixClient extends IntegrationClient {
  private siteId: string = "";

  constructor(
    oauthConfig: OAuthConfig,
    credentials: OAuthToken,
    siteId: string,
    rateLimitConfig?: RateLimitConfig,
  ) {
    super(
      oauthConfig,
      credentials,
      rateLimitConfig || {
        maxRequests: 120,
        windowMs: 60000,
        backoffMultiplier: 2,
        maxBackoffMs: 32000,
      },
    );
    this.baseUrl = "https://www.wixapis.com/v1";
    this.siteId = siteId;
  }

  /**
   * Get products from Wix Stores.
   */
  async getProducts(limit: number = 100, offset: number = 0): Promise<WixProduct[]> {
    try {
      const response = await this.apiCall<{
        items?: WixProduct[];
        total?: number;
      }>("/stores/products", {
        method: "GET",
        params: {
          limit,
          offset,
        },
      });

      return response.data.items || [];
    } catch (error) {
      logger.error("Failed to fetch Wix products", { error });
      throw error;
    }
  }

  /**
   * Get a single product by ID.
   */
  async getProduct(productId: string): Promise<WixProduct | null> {
    try {
      const response = await this.apiCall<WixProduct>(`/stores/products/${productId}`, {
        method: "GET",
      });

      return response.data;
    } catch (error) {
      logger.error("Failed to fetch Wix product", { productId, error });
      return null;
    }
  }

  /**
   * Create a product in Wix Stores.
   */
  async createProduct(product: Partial<WixProduct>): Promise<WixProduct> {
    try {
      const response = await this.apiCall<WixProduct>("/stores/products", {
        method: "POST",
        body: {
          product,
        },
      });

      return response.data;
    } catch (error) {
      logger.error("Failed to create Wix product", { product, error });
      throw error;
    }
  }

  /**
   * Update a product in Wix Stores.
   */
  async updateProduct(productId: string, product: Partial<WixProduct>): Promise<WixProduct> {
    try {
      const response = await this.apiCall<WixProduct>(`/stores/products/${productId}`, {
        method: "PATCH",
        body: {
          product,
        },
      });

      return response.data;
    } catch (error) {
      logger.error("Failed to update Wix product", { productId, error });
      throw error;
    }
  }

  /**
   * Get orders from Wix.
   */
  async getOrders(limit: number = 100, offset: number = 0): Promise<WixOrder[]> {
    try {
      const response = await this.apiCall<{
        orders?: WixOrder[];
        total?: number;
      }>("/orders", {
        method: "GET",
        params: {
          limit,
          offset,
        },
      });

      return response.data.orders || [];
    } catch (error) {
      logger.error("Failed to fetch Wix orders", { error });
      throw error;
    }
  }

  /**
   * Get a single order by ID.
   */
  async getOrder(orderId: string): Promise<WixOrder | null> {
    try {
      const response = await this.apiCall<WixOrder>(`/orders/${orderId}`, {
        method: "GET",
      });

      return response.data;
    } catch (error) {
      logger.error("Failed to fetch Wix order", { orderId, error });
      return null;
    }
  }

  /**
   * Get inventory for a product.
   */
  async getInventory(productId: string): Promise<WixInventory | null> {
    try {
      const response = await this.apiCall<WixInventory>(
        `/stores/products/${productId}/inventory`,
        {
          method: "GET",
        },
      );

      return response.data;
    } catch (error) {
      logger.error("Failed to fetch Wix inventory", { productId, error });
      return null;
    }
  }

  /**
   * Update inventory for a product.
   */
  async updateInventory(
    productId: string,
    quantity: number,
  ): Promise<WixInventory> {
    try {
      const response = await this.apiCall<WixInventory>(
        `/stores/products/${productId}/inventory`,
        {
          method: "PATCH",
          body: {
            quantity,
          },
        },
      );

      return response.data;
    } catch (error) {
      logger.error("Failed to update Wix inventory", { productId, quantity, error });
      throw error;
    }
  }

  /**
   * Get contacts from Wix.
   */
  async getContacts(limit: number = 100, offset: number = 0): Promise<WixContact[]> {
    try {
      const response = await this.apiCall<{
        items?: WixContact[];
        total?: number;
      }>("/contacts", {
        method: "GET",
        params: {
          limit,
          offset,
        },
      });

      return response.data.items || [];
    } catch (error) {
      logger.error("Failed to fetch Wix contacts", { error });
      throw error;
    }
  }

  /**
   * Get a single contact by ID.
   */
  async getContact(contactId: string): Promise<WixContact | null> {
    try {
      const response = await this.apiCall<WixContact>(`/contacts/${contactId}`, {
        method: "GET",
      });

      return response.data;
    } catch (error) {
      logger.error("Failed to fetch Wix contact", { contactId, error });
      return null;
    }
  }

  /**
   * Build request headers with Wix-specific authentication.
   */
  protected async getRequestHeaders(
    customHeaders?: Record<string, string>,
  ): Promise<Record<string, string>> {
    const baseHeaders = await super.getRequestHeaders(customHeaders);

    return {
      ...baseHeaders,
      "wix-account-id": this.siteId,
    };
  }
}

export default WixClient;
