/**
 * Phase E: BigCommerce V3 REST API client.
 *
 * Handles OAuth 2.0 token management and API calls to BigCommerce.
 * Supports products, orders, customers, inventory, channels, and webhooks.
 * Rate limit: 30K requests/hour (429 Too Many Requests).
 */

import {
  IntegrationClient,
  type OAuthConfig,
  type OAuthToken,
  type RateLimitConfig,
} from "@/lib/integrations/base-client";
import { logger } from "@/lib/logger";

const BIGCOMMERCE_OAUTH_CONFIG: OAuthConfig = {
  clientId: process.env.BIGCOMMERCE_CLIENT_ID || "",
  clientSecret: process.env.BIGCOMMERCE_CLIENT_SECRET || "",
  redirectUri: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/integrations/bigcommerce/callback`,
  authorizationUrl: "https://login.bigcommerce.com/oauth/authorize",
  tokenUrl: "https://login.bigcommerce.com/oauth/token",
  revokeUrl: "https://login.bigcommerce.com/oauth/token",
};

// BigCommerce rate limit: 30K req/hour = ~8 req/sec (conservative: 30 req/min = 0.5 req/sec)
const BIGCOMMERCE_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 30,
  windowMs: 60000, // 1 minute
  backoffMultiplier: 2,
  maxBackoffMs: 30000,
};

export interface BigCommerceProduct {
  id: number;
  sku: string;
  name: string;
  description?: string;
  type: "physical" | "digital" | "gift_certificate";
  price: number;
  cost?: number;
  weight?: number;
  categories: number[];
  brand_id?: number;
  inventory_level?: number;
  inventory_tracking?: "none" | "simple" | "sku";
  images?: Array<{ id: number; url: string }>;
  variants?: BigCommerceVariant[];
  custom_fields?: Array<{ id: number; name: string; value: string }>;
}

export interface BigCommerceVariant {
  id: number;
  sku: string;
  price?: number;
  cost?: number;
  weight?: number;
  inventory_level?: number;
  inventory_tracking?: "none" | "simple" | "sku";
}

export interface BigCommerceOrder {
  id: number;
  order_number: string;
  customer_id: number;
  customer_name: string;
  customer_email?: string;
  status: string;
  created_at: string;
  updated_at: string;
  total_inc_tax: number;
  total_ex_tax: number;
  items_total: number;
  items_shipped: number;
  products: Array<{
    id: number;
    product_id: number;
    variant_id?: number;
    quantity: number;
    product_name: string;
    base_price: number;
  }>;
  shipments?: Array<{
    id: number;
    tracking_number?: string;
    items: Array<{ order_product_id: number; quantity: number }>;
  }>;
}

export interface BigCommerceCustomer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  company?: string;
  customer_group_id?: number;
  addresses?: Array<{
    id: number;
    first_name: string;
    last_name: string;
    street_1: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  }>;
}

export interface BigCommerceInventory {
  product_id: number;
  variant_id?: number;
  level: number;
  warehouse_id?: number;
}

export interface BigCommercePagination {
  total: number;
  count: number;
  limit: number;
  offset: number;
  pages: number;
  current_page: number;
  links: {
    first?: string;
    last?: string;
    next?: string;
    previous?: string;
  };
}

export interface BigCommerceListResponse<T> {
  data: T[];
  meta: BigCommercePagination;
}

/**
 * BigCommerce integration client using REST API V3.
 */
export class BigCommerceClient extends IntegrationClient {
  private storeHash = "";

  constructor(credentials: OAuthToken, storeHash: string) {
    super(BIGCOMMERCE_OAUTH_CONFIG, credentials, BIGCOMMERCE_RATE_LIMIT);
    this.storeHash = storeHash;
    this.baseUrl = `https://api.bigcommerce.com/stores/${storeHash}/v3`;
  }

  /**
   * Override apiCall to handle BigCommerce-specific headers.
   */
  async apiCall<T = unknown>(endpoint: string, options: any = {}) {
    const customHeaders = {
      "X-Auth-Token": this.credentials.accessToken,
      ...options.headers,
    };

    return super.apiCall<T>(endpoint, {
      ...options,
      headers: customHeaders,
    });
  }

  /**
   * Get authorization URL for OAuth flow.
   */
  getAuthorizationUrl(state: string): string {
    const url = new URL(BIGCOMMERCE_OAUTH_CONFIG.authorizationUrl);
    url.searchParams.append("client_id", BIGCOMMERCE_OAUTH_CONFIG.clientId);
    url.searchParams.append("redirect_uri", BIGCOMMERCE_OAUTH_CONFIG.redirectUri);
    url.searchParams.append("response_type", "code");
    url.searchParams.append("scope", this.getScopes().join(" "));
    url.searchParams.append("state", state);

    return url.toString();
  }

  /**
   * Get required OAuth scopes.
   */
  private getScopes(): string[] {
    return [
      "store_v2_products",
      "store_v2_orders",
      "store_v2_customers",
      "store_v2_inventory",
      "store_v2_settings",
      "store_v2_shipping",
      "store_v2_payments",
    ];
  }

  // ===== CATALOG / PRODUCTS =====

  /**
   * List products with pagination.
   */
  async listProducts(
    limit = 50,
    offset = 0,
    query?: string,
  ): Promise<BigCommerceListResponse<BigCommerceProduct>> {
    try {
      const params: Record<string, string | number | boolean> = {
        limit,
        offset,
        include: "variants,images,custom_fields",
      };

      if (query) {
        params.name = query;
      }

      const response = await this.apiCall<BigCommerceListResponse<BigCommerceProduct>>(
        "/catalog/products",
        { params },
      );

      return response.data;
    } catch (error) {
      logger.error("Failed to list BigCommerce products", { error });
      throw error;
    }
  }

  /**
   * Get a single product by ID.
   */
  async getProduct(productId: number): Promise<BigCommerceProduct> {
    try {
      const response = await this.apiCall<{ data: BigCommerceProduct }>(
        `/catalog/products/${productId}`,
        { params: { include: "variants,images,custom_fields" } },
      );

      return response.data.data;
    } catch (error) {
      logger.error(`Failed to get BigCommerce product ${productId}`, { error });
      throw error;
    }
  }

  /**
   * Create a new product.
   */
  async createProduct(product: Partial<BigCommerceProduct>): Promise<BigCommerceProduct> {
    try {
      const response = await this.apiCall<{ data: BigCommerceProduct }>("/catalog/products", {
        method: "POST",
        body: product,
      });

      return response.data.data;
    } catch (error) {
      logger.error("Failed to create BigCommerce product", { error });
      throw error;
    }
  }

  /**
   * Update a product.
   */
  async updateProduct(
    productId: number,
    product: Partial<BigCommerceProduct>,
  ): Promise<BigCommerceProduct> {
    try {
      const response = await this.apiCall<{ data: BigCommerceProduct }>(
        `/catalog/products/${productId}`,
        {
          method: "PUT",
          body: product,
        },
      );

      return response.data.data;
    } catch (error) {
      logger.error(`Failed to update BigCommerce product ${productId}`, { error });
      throw error;
    }
  }

  /**
   * Delete a product.
   */
  async deleteProduct(productId: number): Promise<boolean> {
    try {
      await this.apiCall(`/catalog/products/${productId}`, {
        method: "DELETE",
      });

      return true;
    } catch (error) {
      logger.error(`Failed to delete BigCommerce product ${productId}`, { error });
      return false;
    }
  }

  /**
   * List product variants.
   */
  async listVariants(
    productId: number,
    limit = 50,
  ): Promise<BigCommerceListResponse<BigCommerceVariant>> {
    try {
      const response = await this.apiCall<BigCommerceListResponse<BigCommerceVariant>>(
        `/catalog/products/${productId}/variants`,
        { params: { limit } },
      );

      return response.data;
    } catch (error) {
      logger.error(`Failed to list variants for product ${productId}`, { error });
      throw error;
    }
  }

  /**
   * Update a variant.
   */
  async updateVariant(
    productId: number,
    variantId: number,
    variant: Partial<BigCommerceVariant>,
  ): Promise<BigCommerceVariant> {
    try {
      const response = await this.apiCall<{ data: BigCommerceVariant }>(
        `/catalog/products/${productId}/variants/${variantId}`,
        {
          method: "PUT",
          body: variant,
        },
      );

      return response.data.data;
    } catch (error) {
      logger.error(`Failed to update variant ${variantId}`, { error });
      throw error;
    }
  }

  /**
   * List categories.
   */
  async listCategories(limit = 50): Promise<BigCommerceListResponse<any>> {
    try {
      const response = await this.apiCall<BigCommerceListResponse<any>>("/catalog/categories", {
        params: { limit },
      });

      return response.data;
    } catch (error) {
      logger.error("Failed to list BigCommerce categories", { error });
      throw error;
    }
  }

  /**
   * Get brands.
   */
  async listBrands(limit = 50): Promise<BigCommerceListResponse<any>> {
    try {
      const response = await this.apiCall<BigCommerceListResponse<any>>("/catalog/brands", {
        params: { limit },
      });

      return response.data;
    } catch (error) {
      logger.error("Failed to list BigCommerce brands", { error });
      throw error;
    }
  }

  // ===== ORDERS =====

  /**
   * List orders with pagination.
   */
  async listOrders(limit = 50, offset = 0): Promise<BigCommerceListResponse<BigCommerceOrder>> {
    try {
      const response = await this.apiCall<BigCommerceListResponse<BigCommerceOrder>>("/orders", {
        params: { limit, offset, include: "products,shipments" },
      });

      return response.data;
    } catch (error) {
      logger.error("Failed to list BigCommerce orders", { error });
      throw error;
    }
  }

  /**
   * Get a single order by ID.
   */
  async getOrder(orderId: number): Promise<BigCommerceOrder> {
    try {
      const response = await this.apiCall<{ data: BigCommerceOrder }>(`/orders/${orderId}`, {
        params: { include: "products,shipments" },
      });

      return response.data.data;
    } catch (error) {
      logger.error(`Failed to get BigCommerce order ${orderId}`, { error });
      throw error;
    }
  }

  /**
   * Update order status.
   */
  async updateOrderStatus(orderId: number, status: string): Promise<BigCommerceOrder> {
    try {
      const response = await this.apiCall<{ data: BigCommerceOrder }>(`/orders/${orderId}`, {
        method: "PUT",
        body: { status },
      });

      return response.data.data;
    } catch (error) {
      logger.error(`Failed to update order ${orderId} status`, { error });
      throw error;
    }
  }

  /**
   * Create a shipment for an order.
   */
  async createShipment(
    orderId: number,
    shipment: {
      tracking_number?: string;
      items: Array<{ order_product_id: number; quantity: number }>;
    },
  ): Promise<any> {
    try {
      const response = await this.apiCall<{ data: any }>(`/orders/${orderId}/shipments`, {
        method: "POST",
        body: shipment,
      });

      return response.data.data;
    } catch (error) {
      logger.error(`Failed to create shipment for order ${orderId}`, { error });
      throw error;
    }
  }

  /**
   * Create a refund for an order.
   */
  async createRefund(
    orderId: number,
    refund: { items: Array<{ order_product_id: number; quantity: number }>; reason?: string },
  ): Promise<any> {
    try {
      const response = await this.apiCall<{ data: any }>(`/orders/${orderId}/refunds`, {
        method: "POST",
        body: refund,
      });

      return response.data.data;
    } catch (error) {
      logger.error(`Failed to create refund for order ${orderId}`, { error });
      throw error;
    }
  }

  /**
   * Apply a coupon to an order.
   */
  async applyCoupon(orderId: number, couponCode: string): Promise<any> {
    try {
      const response = await this.apiCall<{ data: any }>(`/orders/${orderId}/coupons`, {
        method: "POST",
        body: { code: couponCode },
      });

      return response.data.data;
    } catch (error) {
      logger.error(`Failed to apply coupon to order ${orderId}`, { error });
      throw error;
    }
  }

  // ===== CUSTOMERS =====

  /**
   * List customers with pagination.
   */
  async listCustomers(
    limit = 50,
    offset = 0,
  ): Promise<BigCommerceListResponse<BigCommerceCustomer>> {
    try {
      const response = await this.apiCall<BigCommerceListResponse<BigCommerceCustomer>>(
        "/customers",
        { params: { limit, offset, include: "addresses" } },
      );

      return response.data;
    } catch (error) {
      logger.error("Failed to list BigCommerce customers", { error });
      throw error;
    }
  }

  /**
   * Get a single customer by ID.
   */
  async getCustomer(customerId: number): Promise<BigCommerceCustomer> {
    try {
      const response = await this.apiCall<{ data: BigCommerceCustomer }>(
        `/customers/${customerId}`,
        { params: { include: "addresses" } },
      );

      return response.data.data;
    } catch (error) {
      logger.error(`Failed to get BigCommerce customer ${customerId}`, { error });
      throw error;
    }
  }

  /**
   * Create a new customer.
   */
  async createCustomer(customer: Partial<BigCommerceCustomer>): Promise<BigCommerceCustomer> {
    try {
      const response = await this.apiCall<{ data: BigCommerceCustomer }>("/customers", {
        method: "POST",
        body: customer,
      });

      return response.data.data;
    } catch (error) {
      logger.error("Failed to create BigCommerce customer", { error });
      throw error;
    }
  }

  /**
   * Update a customer.
   */
  async updateCustomer(
    customerId: number,
    customer: Partial<BigCommerceCustomer>,
  ): Promise<BigCommerceCustomer> {
    try {
      const response = await this.apiCall<{ data: BigCommerceCustomer }>(
        `/customers/${customerId}`,
        {
          method: "PUT",
          body: customer,
        },
      );

      return response.data.data;
    } catch (error) {
      logger.error(`Failed to update BigCommerce customer ${customerId}`, { error });
      throw error;
    }
  }

  /**
   * Delete a customer.
   */
  async deleteCustomer(customerId: number): Promise<boolean> {
    try {
      await this.apiCall(`/customers/${customerId}`, {
        method: "DELETE",
      });

      return true;
    } catch (error) {
      logger.error(`Failed to delete BigCommerce customer ${customerId}`, { error });
      return false;
    }
  }

  // ===== INVENTORY =====

  /**
   * Get inventory for a product variant.
   */
  async getInventory(productId: number, variantId?: number): Promise<BigCommerceInventory> {
    try {
      const endpoint = variantId
        ? `/catalog/products/${productId}/variants/${variantId}`
        : `/catalog/products/${productId}`;

      const response = await this.apiCall<{ data: any }>(endpoint);

      return {
        product_id: productId,
        variant_id: variantId,
        level: response.data.data.inventory_level || 0,
      };
    } catch (error) {
      logger.error(`Failed to get inventory for product ${productId}`, { error });
      throw error;
    }
  }

  /**
   * Update inventory level.
   */
  async updateInventory(
    productId: number,
    quantity: number,
    variantId?: number,
  ): Promise<BigCommerceInventory> {
    try {
      const endpoint = variantId
        ? `/catalog/products/${productId}/variants/${variantId}`
        : `/catalog/products/${productId}`;

      const response = await this.apiCall<{ data: any }>(endpoint, {
        method: "PUT",
        body: { inventory_level: quantity },
      });

      return {
        product_id: productId,
        variant_id: variantId,
        level: response.data.data.inventory_level || 0,
      };
    } catch (error) {
      logger.error(`Failed to update inventory for product ${productId}`, { error });
      throw error;
    }
  }

  // ===== CHANNELS =====

  /**
   * List channels/sites.
   */
  async listChannels(): Promise<BigCommerceListResponse<any>> {
    try {
      const response = await this.apiCall<BigCommerceListResponse<any>>("/channels");

      return response.data;
    } catch (error) {
      logger.error("Failed to list BigCommerce channels", { error });
      throw error;
    }
  }

  // ===== WEBHOOKS =====

  /**
   * Register a webhook.
   */
  async registerWebhook(scope: string, destination: string, events?: string[]): Promise<any> {
    try {
      const response = await this.apiCall<{ data: any }>("/hooks", {
        method: "POST",
        body: {
          scope,
          destination,
          is_active: true,
          events: events || [scope],
        },
      });

      return response.data.data;
    } catch (error) {
      logger.error("Failed to register BigCommerce webhook", { error });
      throw error;
    }
  }

  /**
   * List webhooks.
   */
  async listWebhooks(): Promise<BigCommerceListResponse<any>> {
    try {
      const response = await this.apiCall<BigCommerceListResponse<any>>("/hooks");

      return response.data;
    } catch (error) {
      logger.error("Failed to list BigCommerce webhooks", { error });
      throw error;
    }
  }

  /**
   * Delete a webhook.
   */
  async deleteWebhook(webhookId: number): Promise<boolean> {
    try {
      await this.apiCall(`/hooks/${webhookId}`, {
        method: "DELETE",
      });

      return true;
    } catch (error) {
      logger.error(`Failed to delete BigCommerce webhook ${webhookId}`, { error });
      return false;
    }
  }

  // ===== STORE INFO =====

  /**
   * Get store information.
   */
  async getStoreInfo(): Promise<any> {
    try {
      const response = await this.apiCall<{ data: any }>("/store");

      return response.data.data;
    } catch (error) {
      logger.error("Failed to get BigCommerce store info", { error });
      throw error;
    }
  }

  // ===== SHIPPING =====

  /**
   * List shipping zones.
   */
  async listShippingZones(): Promise<BigCommerceListResponse<any>> {
    try {
      const response = await this.apiCall<BigCommerceListResponse<any>>("/shipping/zones");

      return response.data;
    } catch (error) {
      logger.error("Failed to list BigCommerce shipping zones", { error });
      throw error;
    }
  }

  /**
   * Get shipping methods for a zone.
   */
  async listShippingMethods(zoneId: number): Promise<BigCommerceListResponse<any>> {
    try {
      const response = await this.apiCall<BigCommerceListResponse<any>>(
        `/shipping/zones/${zoneId}/methods`,
      );

      return response.data;
    } catch (error) {
      logger.error(`Failed to list shipping methods for zone ${zoneId}`, { error });
      throw error;
    }
  }

  // ===== TAX =====

  /**
   * List tax classes.
   */
  async listTaxClasses(): Promise<BigCommerceListResponse<any>> {
    try {
      const response = await this.apiCall<BigCommerceListResponse<any>>("/tax/classes");

      return response.data;
    } catch (error) {
      logger.error("Failed to list BigCommerce tax classes", { error });
      throw error;
    }
  }

  /**
   * Set the store hash (for multi-store scenarios).
   */
  setStoreHash(storeHash: string): void {
    this.storeHash = storeHash;
    this.baseUrl = `https://api.bigcommerce.com/stores/${storeHash}/v3`;
  }

  /**
   * Get the current store hash.
   */
  getStoreHash(): string {
    return this.storeHash;
  }
}

export default BigCommerceClient;
