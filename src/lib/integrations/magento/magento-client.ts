/**
 * Phase E: Adobe Commerce (Magento) REST API client.
 *
 * Handles Bearer token authentication and API calls to Adobe Commerce.
 * Supports products, orders, customers, inventory (MSI), categories, and more.
 * Rate limit: ~30 req/sec (implemented via request throttling).
 */

import {
  IntegrationClient,
  type OAuthConfig,
  type OAuthToken,
  type RateLimitConfig,
} from "@/lib/integrations/base-client";
import { logger } from "@/lib/logger";

// Magento doesn't use traditional OAuth for API tokens, but we store credentials similarly
const MAGENTO_OAUTH_CONFIG: OAuthConfig = {
  clientId: process.env.MAGENTO_CLIENT_ID || "",
  clientSecret: process.env.MAGENTO_CLIENT_SECRET || "",
  redirectUri: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/integrations/magento/callback`,
  authorizationUrl: "",
  tokenUrl: "",
};

// Magento rate limit: ~30 req/sec = 1800 req/min
const MAGENTO_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 1800,
  windowMs: 60000, // 1 minute
  backoffMultiplier: 2,
  maxBackoffMs: 30000,
};

export interface MagentoProduct {
  id: number;
  sku: string;
  name: string;
  description?: string;
  short_description?: string;
  type_id: "simple" | "configurable" | "virtual" | "downloadable" | "bundle" | "grouped";
  price: number;
  cost?: number;
  weight?: number;
  visibility: number;
  status: number;
  extension_attributes?: {
    stock_item?: {
      item_id: number;
      product_id: number;
      qty: number;
      is_in_stock: boolean;
      manage_stock: boolean;
    };
    category_links?: Array<{ position: number; category_id: number }>;
    configurable_product_options?: Array<{
      id: number;
      attribute_id: number;
      label: string;
      values: Array<{
        value_index: number;
        label: string;
      }>;
    }>;
    configurable_product_links?: number[];
  };
  custom_attributes?: Array<{
    attribute_code: string;
    value: string | string[];
  }>;
}

export interface MagentoOrder {
  entity_id: number;
  increment_id: string;
  customer_id: number;
  customer_email: string;
  customer_firstname: string;
  customer_lastname: string;
  status: string;
  state: string;
  created_at: string;
  updated_at: string;
  grand_total: number;
  total_due?: number;
  items_ordered?: number;
  items_shipped?: number;
  items: Array<{
    item_id: number;
    order_id: number;
    product_id: number;
    product_type: string;
    product_sku: string;
    product_name: string;
    qty_ordered: number;
    qty_shipped?: number;
    price: number;
    row_total: number;
  }>;
  shipments?: Array<{
    entity_id: number;
    order_id: number;
    created_at: string;
    items: Array<{
      entity_id: number;
      parent_id: number;
      order_item_id: number;
      qty: number;
    }>;
    tracks?: Array<{
      entity_id: number;
      track_number: string;
      carrier_code: string;
    }>;
  }>;
  extension_attributes?: {
    shipping_assignments?: Array<{
      shipping: {
        address: {
          region: string;
          postcode: string;
          lastname: string;
          firstname: string;
          street: string[];
          city: string;
          country_id: string;
        };
        method: string;
      };
    }>;
  };
}

export interface MagentoCustomer {
  id: number;
  email: string;
  firstname: string;
  lastname: string;
  middlename?: string;
  prefix?: string;
  suffix?: string;
  dob?: string;
  group_id?: number;
  created_at: string;
  updated_at: string;
  addresses?: Array<{
    id: number;
    customer_id: number;
    region: { region_code: string; region: string; region_id: number };
    region_id: number;
    country_id: string;
    street: string[];
    telephone?: string;
    postcode: string;
    city: string;
    firstname: string;
    lastname: string;
    is_default_billing?: boolean;
    is_default_shipping?: boolean;
  }>;
  custom_attributes?: Array<{
    attribute_code: string;
    value: string;
  }>;
}

export interface MagentoInventoryItem {
  sku: string;
  source_code: string;
  quantity: number;
  status: 1 | 0;
}

export interface MagentoCategory {
  id: number;
  parent_id: number;
  name: string;
  description?: string;
  is_active: boolean;
  position: number;
  level: number;
  children?: string;
}

export interface MagentoSearchResult<T> {
  items: T[];
  search_criteria: {
    request_name: string;
    filter_groups: any[];
    page_size: number;
    current_page: number;
    sort_orders?: any[];
  };
  total_count: number;
}

/**
 * Adobe Commerce integration client using REST API.
 */
export class MagentoClient extends IntegrationClient {
  private domain = "";
  private bearerToken = "";

  constructor(credentials: OAuthToken, domain: string) {
    super(MAGENTO_OAUTH_CONFIG, credentials, MAGENTO_RATE_LIMIT);
    this.domain = domain;
    this.bearerToken = credentials.accessToken;
    this.baseUrl = `https://${domain}/rest/V1`;
  }

  /**
   * Override apiCall to use Bearer token in Authorization header.
   */
  async apiCall<T = unknown>(endpoint: string, options: any = {}) {
    const customHeaders = {
      Authorization: `Bearer ${this.bearerToken}`,
      ...options.headers,
    };

    return super.apiCall<T>(endpoint, {
      ...options,
      headers: customHeaders,
    });
  }

  /**
   * Get required scopes (for future OAuth implementation).
   */
  private getScopes(): string[] {
    return [
      "catalog:read",
      "catalog:write",
      "orders:read",
      "orders:write",
      "customers:read",
      "customers:write",
      "inventory:read",
      "inventory:write",
    ];
  }

  // ===== PRODUCTS =====

  /**
   * List products with search criteria.
   */
  async listProducts(
    pageSize = 50,
    currentPage = 1,
    filters?: Record<string, string | number>,
  ): Promise<MagentoSearchResult<MagentoProduct>> {
    try {
      const params: Record<string, string | number | boolean> = {
        "searchCriteria[pageSize]": pageSize,
        "searchCriteria[currentPage]": currentPage,
      };

      // Add filters
      let filterIndex = 0;
      if (filters) {
        for (const [key, value] of Object.entries(filters)) {
          params[`searchCriteria[filter_groups][${filterIndex}][filters][0][field]`] = key;
          params[`searchCriteria[filter_groups][${filterIndex}][filters][0][value]`] = value;
          params[`searchCriteria[filter_groups][${filterIndex}][filters][0][condition_type]`] =
            "eq";
          filterIndex++;
        }
      }

      const response = await this.apiCall<MagentoSearchResult<MagentoProduct>>("/products", {
        params,
      });

      return response.data;
    } catch (error) {
      logger.error("Failed to list Magento products", { error });
      throw error;
    }
  }

  /**
   * Get a single product by SKU.
   */
  async getProduct(sku: string): Promise<MagentoProduct> {
    try {
      const response = await this.apiCall<MagentoProduct>(`/products/${sku}`);

      return response.data;
    } catch (error) {
      logger.error(`Failed to get Magento product ${sku}`, { error });
      throw error;
    }
  }

  /**
   * Create a new product.
   */
  async createProduct(product: Partial<MagentoProduct>): Promise<MagentoProduct> {
    try {
      const response = await this.apiCall<MagentoProduct>("/products", {
        method: "POST",
        body: { product },
      });

      return response.data;
    } catch (error) {
      logger.error("Failed to create Magento product", { error });
      throw error;
    }
  }

  /**
   * Update a product by SKU.
   */
  async updateProduct(sku: string, product: Partial<MagentoProduct>): Promise<MagentoProduct> {
    try {
      const response = await this.apiCall<MagentoProduct>(`/products/${sku}`, {
        method: "PUT",
        body: { product },
      });

      return response.data;
    } catch (error) {
      logger.error(`Failed to update Magento product ${sku}`, { error });
      throw error;
    }
  }

  /**
   * Delete a product by SKU.
   */
  async deleteProduct(sku: string): Promise<boolean> {
    try {
      await this.apiCall(`/products/${sku}`, {
        method: "DELETE",
      });

      return true;
    } catch (error) {
      logger.error(`Failed to delete Magento product ${sku}`, { error });
      return false;
    }
  }

  // ===== ORDERS =====

  /**
   * List orders with search criteria.
   */
  async listOrders(
    pageSize = 50,
    currentPage = 1,
    filters?: Record<string, string | number>,
  ): Promise<MagentoSearchResult<MagentoOrder>> {
    try {
      const params: Record<string, string | number | boolean> = {
        "searchCriteria[pageSize]": pageSize,
        "searchCriteria[currentPage]": currentPage,
      };

      // Add filters
      let filterIndex = 0;
      if (filters) {
        for (const [key, value] of Object.entries(filters)) {
          params[`searchCriteria[filter_groups][${filterIndex}][filters][0][field]`] = key;
          params[`searchCriteria[filter_groups][${filterIndex}][filters][0][value]`] = value;
          params[`searchCriteria[filter_groups][${filterIndex}][filters][0][condition_type]`] =
            "eq";
          filterIndex++;
        }
      }

      const response = await this.apiCall<MagentoSearchResult<MagentoOrder>>("/orders", { params });

      return response.data;
    } catch (error) {
      logger.error("Failed to list Magento orders", { error });
      throw error;
    }
  }

  /**
   * Get a single order by ID.
   */
  async getOrder(orderId: number): Promise<MagentoOrder> {
    try {
      const response = await this.apiCall<MagentoOrder>(`/orders/${orderId}`);

      return response.data;
    } catch (error) {
      logger.error(`Failed to get Magento order ${orderId}`, { error });
      throw error;
    }
  }

  /**
   * Update order status.
   */
  async updateOrderStatus(orderId: number, status: string, comment?: string): Promise<boolean> {
    try {
      await this.apiCall(`/orders/${orderId}/comments`, {
        method: "POST",
        body: {
          statusHistory: {
            status,
            is_customer_notified: true,
            comment,
          },
        },
      });

      return true;
    } catch (error) {
      logger.error(`Failed to update Magento order ${orderId} status`, { error });
      return false;
    }
  }

  /**
   * Create a shipment for an order.
   */
  async createShipment(
    orderId: number,
    items: Array<{ order_item_id: number; qty: number }>,
    trackingNumber?: string,
  ): Promise<number> {
    try {
      const response = await this.apiCall<{ entity_id: number }>(`/orders/${orderId}/shipments`, {
        method: "POST",
        body: {
          shipment: {
            items,
            tracks: trackingNumber
              ? [{ track_number: trackingNumber, carrier_code: "custom" }]
              : undefined,
          },
        },
      });

      return response.data.entity_id;
    } catch (error) {
      logger.error(`Failed to create shipment for order ${orderId}`, { error });
      throw error;
    }
  }

  /**
   * Create an invoice for an order.
   */
  async createInvoice(
    orderId: number,
    items: Array<{ order_item_id: number; qty: number }>,
  ): Promise<number> {
    try {
      const response = await this.apiCall<{ entity_id: number }>(`/orders/${orderId}/invoices`, {
        method: "POST",
        body: {
          invoice: {
            items,
          },
        },
      });

      return response.data.entity_id;
    } catch (error) {
      logger.error(`Failed to create invoice for order ${orderId}`, { error });
      throw error;
    }
  }

  /**
   * Create a credit memo for an order.
   */
  async createCreditMemo(
    orderId: number,
    items: Array<{ order_item_id: number; qty: number }>,
  ): Promise<number> {
    try {
      const response = await this.apiCall<{ entity_id: number }>(`/orders/${orderId}/refunds`, {
        method: "POST",
        body: {
          creditmemo: {
            items,
          },
        },
      });

      return response.data.entity_id;
    } catch (error) {
      logger.error(`Failed to create credit memo for order ${orderId}`, { error });
      throw error;
    }
  }

  // ===== CUSTOMERS =====

  /**
   * List customers with search criteria.
   */
  async listCustomers(
    pageSize = 50,
    currentPage = 1,
  ): Promise<MagentoSearchResult<MagentoCustomer>> {
    try {
      const params = {
        "searchCriteria[pageSize]": pageSize,
        "searchCriteria[currentPage]": currentPage,
      };

      const response = await this.apiCall<MagentoSearchResult<MagentoCustomer>>(
        "/customers/search",
        { params },
      );

      return response.data;
    } catch (error) {
      logger.error("Failed to list Magento customers", { error });
      throw error;
    }
  }

  /**
   * Get a single customer by ID.
   */
  async getCustomer(customerId: number): Promise<MagentoCustomer> {
    try {
      const response = await this.apiCall<MagentoCustomer>(`/customers/${customerId}`);

      return response.data;
    } catch (error) {
      logger.error(`Failed to get Magento customer ${customerId}`, { error });
      throw error;
    }
  }

  /**
   * Create a new customer.
   */
  async createCustomer(customer: Partial<MagentoCustomer>): Promise<MagentoCustomer> {
    try {
      const response = await this.apiCall<MagentoCustomer>("/customers", {
        method: "POST",
        body: { customer },
      });

      return response.data;
    } catch (error) {
      logger.error("Failed to create Magento customer", { error });
      throw error;
    }
  }

  /**
   * Update a customer.
   */
  async updateCustomer(
    customerId: number,
    customer: Partial<MagentoCustomer>,
  ): Promise<MagentoCustomer> {
    try {
      const response = await this.apiCall<MagentoCustomer>(`/customers/${customerId}`, {
        method: "PUT",
        body: { customer },
      });

      return response.data;
    } catch (error) {
      logger.error(`Failed to update Magento customer ${customerId}`, { error });
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
      logger.error(`Failed to delete Magento customer ${customerId}`, { error });
      return false;
    }
  }

  // ===== INVENTORY (MSI) =====

  /**
   * Get inventory for a product at a source.
   */
  async getInventoryItem(sku: string, sourceCode = "default"): Promise<MagentoInventoryItem> {
    try {
      const response = await this.apiCall<MagentoInventoryItem>("/inventory/source-items", {
        params: {
          "searchCriteria[filter_groups][0][filters][0][field]": "sku",
          "searchCriteria[filter_groups][0][filters][0][value]": sku,
          "searchCriteria[filter_groups][1][filters][0][field]": "source_code",
          "searchCriteria[filter_groups][1][filters][0][value]": sourceCode,
        },
      });

      return response.data;
    } catch (error) {
      logger.error(`Failed to get inventory for ${sku}`, { error });
      throw error;
    }
  }

  /**
   * Update inventory quantity.
   */
  async updateInventory(sku: string, quantity: number, sourceCode = "default"): Promise<boolean> {
    try {
      await this.apiCall("/inventory/source-items", {
        method: "POST",
        body: {
          sourceItems: [
            {
              sku,
              source_code: sourceCode,
              quantity,
              status: quantity > 0 ? 1 : 0,
            },
          ],
        },
      });

      return true;
    } catch (error) {
      logger.error(`Failed to update inventory for ${sku}`, { error });
      return false;
    }
  }

  /**
   * List inventory sources.
   */
  async listInventorySources(): Promise<MagentoSearchResult<any>> {
    try {
      const response = await this.apiCall<MagentoSearchResult<any>>("/inventory/sources");

      return response.data;
    } catch (error) {
      logger.error("Failed to list inventory sources", { error });
      throw error;
    }
  }

  // ===== CATEGORIES =====

  /**
   * Get category tree.
   */
  async getCategoryTree(): Promise<any> {
    try {
      const response = await this.apiCall<any>("/categories");

      return response.data;
    } catch (error) {
      logger.error("Failed to get category tree", { error });
      throw error;
    }
  }

  /**
   * Get a single category.
   */
  async getCategory(categoryId: number): Promise<MagentoCategory> {
    try {
      const response = await this.apiCall<MagentoCategory>(`/categories/${categoryId}`);

      return response.data;
    } catch (error) {
      logger.error(`Failed to get Magento category ${categoryId}`, { error });
      throw error;
    }
  }

  /**
   * Create a category.
   */
  async createCategory(category: Partial<MagentoCategory>): Promise<MagentoCategory> {
    try {
      const response = await this.apiCall<MagentoCategory>("/categories", {
        method: "POST",
        body: { category },
      });

      return response.data;
    } catch (error) {
      logger.error("Failed to create Magento category", { error });
      throw error;
    }
  }

  /**
   * Update a category.
   */
  async updateCategory(
    categoryId: number,
    category: Partial<MagentoCategory>,
  ): Promise<MagentoCategory> {
    try {
      const response = await this.apiCall<MagentoCategory>(`/categories/${categoryId}`, {
        method: "PUT",
        body: { category },
      });

      return response.data;
    } catch (error) {
      logger.error(`Failed to update Magento category ${categoryId}`, { error });
      throw error;
    }
  }

  // ===== TAX =====

  /**
   * List tax rates.
   */
  async listTaxRates(): Promise<MagentoSearchResult<any>> {
    try {
      const response = await this.apiCall<MagentoSearchResult<any>>("/taxRates/search");

      return response.data;
    } catch (error) {
      logger.error("Failed to list tax rates", { error });
      throw error;
    }
  }

  /**
   * List tax rules.
   */
  async listTaxRules(): Promise<MagentoSearchResult<any>> {
    try {
      const response = await this.apiCall<MagentoSearchResult<any>>("/taxRules/search");

      return response.data;
    } catch (error) {
      logger.error("Failed to list tax rules", { error });
      throw error;
    }
  }

  // ===== COUPONS =====

  /**
   * List cart price rules (coupons).
   */
  async listCouponRules(): Promise<MagentoSearchResult<any>> {
    try {
      const response = await this.apiCall<MagentoSearchResult<any>>("/coupons/search");

      return response.data;
    } catch (error) {
      logger.error("Failed to list coupon rules", { error });
      throw error;
    }
  }

  /**
   * Create a cart price rule (coupon).
   */
  async createCoupon(coupon: any): Promise<any> {
    try {
      const response = await this.apiCall<any>("/coupons", {
        method: "POST",
        body: { coupon },
      });

      return response.data;
    } catch (error) {
      logger.error("Failed to create coupon", { error });
      throw error;
    }
  }

  // ===== CMS =====

  /**
   * List CMS pages.
   */
  async listCmsPages(): Promise<MagentoSearchResult<any>> {
    try {
      const response = await this.apiCall<MagentoSearchResult<any>>("/cmsPage/search");

      return response.data;
    } catch (error) {
      logger.error("Failed to list CMS pages", { error });
      throw error;
    }
  }

  /**
   * List CMS blocks.
   */
  async listCmsBlocks(): Promise<MagentoSearchResult<any>> {
    try {
      const response = await this.apiCall<MagentoSearchResult<any>>("/cmsBlock/search");

      return response.data;
    } catch (error) {
      logger.error("Failed to list CMS blocks", { error });
      throw error;
    }
  }

  /**
   * Set the domain.
   */
  setDomain(domain: string): void {
    this.domain = domain;
    this.baseUrl = `https://${domain}/rest/V1`;
  }

  /**
   * Get the current domain.
   */
  getDomain(): string {
    return this.domain;
  }
}

export default MagentoClient;
