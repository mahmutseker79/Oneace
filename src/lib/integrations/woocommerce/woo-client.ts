/**
 * Phase E: Comprehensive WooCommerce REST API Client.
 *
 * WooCommerce uses consumer key + consumer secret (not OAuth).
 * Supports both HTTP (HMAC signature in header) and HTTPS (query params).
 * Full v3 REST API coverage:
 * - Products (CRUD, variations, categories, tags, attributes, images, reviews)
 * - Orders (list, get, create, update, notes, refunds)
 * - Customers (CRUD, downloads)
 * - Coupons (CRUD)
 * - Shipping (zones, methods, classes)
 * - Tax (rates, classes)
 * - Reports (sales, top sellers, order totals)
 * - Webhooks (CRUD)
 * - Settings, System Status
 */

import * as crypto from "crypto";
import { logger } from "@/lib/logger";

// ── WooCommerce API Credentials ─────────────────────────────────

export interface WooCredentials {
  siteUrl: string; // e.g., https://myshop.com
  consumerKey: string;
  consumerSecret: string;
}

export interface RateLimitConfig {
  maxRequestsPerSecond: number;
  retryAttempts: number;
  retryDelayMs: number;
}

// ── WooCommerce Response Types ──────────────────────────────────

export interface WooProduct {
  id: number;
  name: string;
  slug: string;
  description?: string;
  short_description?: string;
  sku?: string;
  regular_price?: string;
  sale_price?: string;
  date_created?: string;
  date_modified?: string;
  status: "draft" | "pending" | "private" | "publish";
  featured: boolean;
  catalog_visibility: "visible" | "catalog" | "search" | "hidden";
  type: "simple" | "grouped" | "external" | "variable";
  stock_quantity?: number;
  stock_status: "instock" | "outofstock" | "onbackorder";
  weight?: string;
  dimensions?: { length: string; width: string; height: string };
  shipping_class?: string;
  categories?: Array<{ id: number; name: string; slug: string }>;
  tags?: Array<{ id: number; name: string; slug: string }>;
  images?: Array<{
    id: number;
    src: string;
    name?: string;
    alt?: string;
  }>;
  attributes?: Array<{
    id: number;
    name: string;
    options: string[];
    variation: boolean;
    visible: boolean;
  }>;
  variations?: number[];
  meta_data?: Array<{ key: string; value: unknown }>;
}

export interface WooVariation {
  id: number;
  product_id: number;
  sku?: string;
  regular_price?: string;
  sale_price?: string;
  date_created?: string;
  date_modified?: string;
  status: "publish" | "private" | "draft";
  stock_quantity?: number;
  stock_status: "instock" | "outofstock" | "onbackorder";
  weight?: string;
  attributes?: Array<{ id: number; name: string; option: string }>;
  image?: {
    id: number;
    src: string;
    name?: string;
    alt?: string;
  };
}

export interface WooOrder {
  id: number;
  number: string;
  order_key?: string;
  created_via?: string;
  version?: string;
  status: "pending" | "processing" | "on-hold" | "completed" | "cancelled" | "refunded" | "failed";
  currency: string;
  date_created?: string;
  date_modified?: string;
  date_completed?: string;
  date_paid?: string;
  discount_total?: string;
  discount_tax?: string;
  shipping_total?: string;
  shipping_tax?: string;
  cart_tax?: string;
  total?: string;
  total_tax?: string;
  customer_id: number;
  customer_note?: string;
  billing?: WooAddress;
  shipping?: WooAddress;
  payment_method?: string;
  payment_method_title?: string;
  transaction_id?: string;
  line_items?: WooOrderLineItem[];
  coupon_lines?: Array<{
    id: number;
    code: string;
    discount: string;
    discount_tax: string;
  }>;
  shipping_lines?: Array<{
    id: number;
    method_title: string;
    method_id: string;
    total: string;
    total_tax: string;
    taxes?: Array<{ id: number; total: string }>;
  }>;
  fee_lines?: Array<{ id: number; name: string; total: string; total_tax: string }>;
  tax_lines?: Array<{ id: number; rate_code: string; rate_id: number; label: string; total: string }>;
  refunds?: WooRefund[];
}

export interface WooOrderLineItem {
  id: number;
  name: string;
  product_id: number;
  variation_id: number;
  quantity: number;
  tax_class: string;
  subtotal: string;
  subtotal_tax: string;
  total: string;
  total_tax: string;
  sku?: string;
  price?: string;
  meta_data?: Array<{ key: string; value: unknown }>;
}

export interface WooCustomer {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  billing?: WooAddress;
  shipping?: WooAddress;
  is_paying_customer?: boolean;
  avatar_url?: string;
  meta_data?: Array<{ key: string; value: unknown }>;
}

export interface WooAddress {
  first_name?: string;
  last_name?: string;
  company?: string;
  address_1?: string;
  address_2?: string;
  city?: string;
  postcode?: string;
  country?: string;
  state?: string;
  email?: string;
  phone?: string;
}

export interface WooCoupon {
  id: number;
  code: string;
  amount?: string;
  status: "publish" | "draft" | "pending" | "private";
  date_created?: string;
  date_modified?: string;
  discount_type: "fixed_cart" | "percent" | "fixed_product" | "percent_product";
  description?: string;
  date_expires?: string;
  usage_count?: number;
  individual_use?: boolean;
  product_ids?: number[];
  excluded_product_ids?: number[];
  usage_limit?: number;
  usage_limit_per_user?: number;
  minimum_amount?: string;
  maximum_amount?: string;
  email_restrictions?: string[];
}

export interface WooWebhook {
  id: number;
  name: string;
  status: "active" | "paused" | "disabled";
  topic: string;
  resource: string;
  event: string;
  hooks?: string[];
  delivery_url?: string;
  secret?: string;
  api_version?: string;
  date_created?: string;
  date_modified?: string;
}

export interface WooShippingZone {
  id: number;
  name: string;
  order?: number;
  locations?: Array<{
    code: string;
    type: "postcode" | "state" | "country" | "continent";
  }>;
  methods?: WooShippingMethod[];
}

export interface WooShippingMethod {
  id: string;
  instance_id?: number;
  title: string;
  order: number;
  enabled: boolean;
  method_id: string;
  method_title?: string;
  settings?: Record<string, unknown>;
}

export interface WooTaxRate {
  id: number;
  country: string;
  state?: string;
  postcode?: string;
  city?: string;
  rate: string;
  name?: string;
  priority?: number;
  compound?: boolean;
  shipping?: boolean;
  order?: number;
  class: string;
}

export interface WooReport {
  period: string;
  sales: string;
  orders: number;
  items_sold: number;
  gross_revenue: string;
  net_revenue?: string;
}

export interface WooSystemStatus {
  environment?: {
    home_url?: string;
    site_url?: string;
    wp_version?: string;
    wp_multisite?: boolean;
    wp_memory_limit?: string;
    wp_debug_mode?: boolean;
    language?: string;
    external_object_cache?: boolean;
  };
  database?: {
    wc_database_version?: string;
    database_prefix?: string;
    max_allowed_packet?: string;
    iam_support?: boolean;
  };
  extensions?: Array<{ plugin: string; version: string }>;
}

// ── Pagination Headers ──────────────────────────────────────────

export interface PaginationHeaders {
  total: number;
  totalPages: number;
  currentPage: number;
}

// ── Error Types ─────────────────────────────────────────────────

export interface WooClientError extends Error {
  code: string;
  statusCode?: number;
  retryable: boolean;
  originalError?: Error;
}

/**
 * WooCommerce REST API v3 Client.
 * Uses API key + secret authentication (HMAC or query params).
 */
export class WooClient {
  private credentials: WooCredentials;
  private rateLimitConfig: RateLimitConfig;
  private requestQueue: Array<() => Promise<unknown>> = [];
  private isProcessing = false;
  private lastRequestTime = 0;

  constructor(credentials: WooCredentials, rateLimitConfig?: Partial<RateLimitConfig>) {
    this.credentials = credentials;
    this.rateLimitConfig = {
      maxRequestsPerSecond: 25,
      retryAttempts: 3,
      retryDelayMs: 1000,
      ...rateLimitConfig,
    };
  }

  /**
   * Generate HMAC signature for HTTP requests.
   */
  private generateSignature(method: string, path: string): string {
    const message = `${method}\n${path}`;
    const signature = crypto
      .createHmac("sha256", this.credentials.consumerSecret)
      .update(message)
      .digest("base64");
    return signature;
  }

  /**
   * Build authorization header or query params.
   */
  private getAuthHeader(
    method: string,
    path: string,
  ): {
    header?: Record<string, string>;
    params?: Record<string, string>;
  } {
    const isHttps = this.credentials.siteUrl.startsWith("https");

    if (isHttps) {
      // HTTPS: use query parameters
      return {
        params: {
          consumer_key: this.credentials.consumerKey,
          consumer_secret: this.credentials.consumerSecret,
        },
      };
    } else {
      // HTTP: use HMAC signature in header
      const signature = this.generateSignature(method, path);
      return {
        header: {
          Authorization: `Basic ${Buffer.from(
            `${this.credentials.consumerKey}:${signature}`,
          ).toString("base64")}`,
        },
      };
    }
  }

  /**
   * Rate limiting: queue requests and enforce 25 req/sec.
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minIntervalMs = 1000 / this.rateLimitConfig.maxRequestsPerSecond;

    if (timeSinceLastRequest < minIntervalMs) {
      await new Promise((resolve) => setTimeout(resolve, minIntervalMs - timeSinceLastRequest));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Make an API request with error handling, rate limiting, and retries.
   */
  private async apiCall<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
    customParams?: Record<string, string | number | boolean>,
  ): Promise<{ data: T; pagination: PaginationHeaders }> {
    await this.enforceRateLimit();

    const auth = this.getAuthHeader(method, path);
    const url = new URL(path.startsWith("http") ? path : `${this.credentials.siteUrl}${path}`);

    // Add auth params
    if (auth.params) {
      Object.entries(auth.params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    // Add custom params
    if (customParams) {
      Object.entries(customParams).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.rateLimitConfig.retryAttempts; attempt++) {
      try {
        const fetchOptions: RequestInit = {
          method,
          headers: {
            "Content-Type": "application/json",
            ...auth.header,
          },
        };

        if (body && (method === "POST" || method === "PUT" || method === "PATCH")) {
          fetchOptions.body = JSON.stringify(body);
        }

        const response = await fetch(url.toString(), fetchOptions);

        if (!response.ok) {
          const isRetryable = response.status >= 500 || response.status === 429;

          if (response.status === 401 || response.status === 403) {
            throw this.createError("AUTH_ERROR", "Authentication failed", false, response.status);
          }

          throw this.createError(
            `HTTP_${response.status}`,
            `WooCommerce API error: ${response.statusText}`,
            isRetryable,
            response.status,
          );
        }

        const data = (await response.json()) as T;

        const pagination: PaginationHeaders = {
          total: parseInt(response.headers.get("X-WP-Total") || "0", 10),
          totalPages: parseInt(response.headers.get("X-WP-TotalPages") || "0", 10),
          currentPage: parseInt(response.headers.get("X-WP-CurrentPage") || "1", 10),
        };

        return { data, pagination };
      } catch (error) {
        lastError = error as Error;

        if (error instanceof Error && "retryable" in error) {
          const integrationError = error as WooClientError;
          if (!integrationError.retryable || attempt === this.rateLimitConfig.retryAttempts - 1) {
            throw error;
          }
        }

        logger.warn("WooCommerce API call failed, retrying", {
          method,
          path,
          attempt,
          error: error instanceof Error ? error.message : "Unknown error",
        });

        await new Promise((resolve) =>
          setTimeout(resolve, this.rateLimitConfig.retryDelayMs * (attempt + 1)),
        );
      }
    }

    throw lastError || this.createError("API_CALL_FAILED", "Max retries exceeded", false);
  }

  /**
   * Create a typed WooCommerce error.
   */
  private createError(
    code: string,
    message: string,
    retryable: boolean,
    statusCode?: number,
    originalError?: Error,
  ): WooClientError {
    const error = new Error(message) as WooClientError;
    error.code = code;
    error.statusCode = statusCode;
    error.retryable = retryable;
    error.originalError = originalError;
    error.name = "WooClientError";
    return error;
  }

  // ── PRODUCTS ────────────────────────────────────────────────────

  /**
   * List products with optional filters.
   */
  async listProducts(
    page = 1,
    perPage = 100,
    filters?: {
      search?: string;
      status?: string;
      sku?: string;
      category?: number;
      tag?: number;
    },
  ): Promise<{ products: WooProduct[]; pagination: PaginationHeaders }> {
    const params: Record<string, string | number | boolean> = {
      page,
      per_page: perPage,
    };

    if (filters?.search) params.search = filters.search;
    if (filters?.status) params.status = filters.status;
    if (filters?.sku) params.sku = filters.sku;
    if (filters?.category) params.category = filters.category;
    if (filters?.tag) params.tag = filters.tag;

    const { data, pagination } = await this.apiCall<WooProduct[]>(
      "GET",
      "/wp-json/wc/v3/products",
      undefined,
      params,
    );

    return { products: data, pagination };
  }

  /**
   * Get a single product.
   */
  async getProduct(productId: number): Promise<WooProduct> {
    const { data } = await this.apiCall<WooProduct>(
      "GET",
      `/wp-json/wc/v3/products/${productId}`,
    );
    return data;
  }

  /**
   * Create a product.
   */
  async createProduct(product: Partial<WooProduct>): Promise<WooProduct> {
    const { data } = await this.apiCall<WooProduct>(
      "POST",
      "/wp-json/wc/v3/products",
      product,
    );
    return data;
  }

  /**
   * Update a product.
   */
  async updateProduct(productId: number, updates: Partial<WooProduct>): Promise<WooProduct> {
    const { data } = await this.apiCall<WooProduct>(
      "PUT",
      `/wp-json/wc/v3/products/${productId}`,
      updates,
    );
    return data;
  }

  /**
   * Delete a product.
   */
  async deleteProduct(productId: number, force = false): Promise<WooProduct> {
    const { data } = await this.apiCall<WooProduct>(
      "DELETE",
      `/wp-json/wc/v3/products/${productId}`,
      undefined,
      { force: force ? "true" : "false" },
    );
    return data;
  }

  /**
   * List product variations.
   */
  async listProductVariations(
    productId: number,
    page = 1,
    perPage = 100,
  ): Promise<{ variations: WooVariation[]; pagination: PaginationHeaders }> {
    const { data, pagination } = await this.apiCall<WooVariation[]>(
      "GET",
      `/wp-json/wc/v3/products/${productId}/variations`,
      undefined,
      { page, per_page: perPage },
    );
    return { variations: data, pagination };
  }

  /**
   * Get a product variation.
   */
  async getProductVariation(productId: number, variationId: number): Promise<WooVariation> {
    const { data } = await this.apiCall<WooVariation>(
      "GET",
      `/wp-json/wc/v3/products/${productId}/variations/${variationId}`,
    );
    return data;
  }

  /**
   * Create a product variation.
   */
  async createProductVariation(
    productId: number,
    variation: Partial<WooVariation>,
  ): Promise<WooVariation> {
    const { data } = await this.apiCall<WooVariation>(
      "POST",
      `/wp-json/wc/v3/products/${productId}/variations`,
      variation,
    );
    return data;
  }

  /**
   * Update a product variation.
   */
  async updateProductVariation(
    productId: number,
    variationId: number,
    updates: Partial<WooVariation>,
  ): Promise<WooVariation> {
    const { data } = await this.apiCall<WooVariation>(
      "PUT",
      `/wp-json/wc/v3/products/${productId}/variations/${variationId}`,
      updates,
    );
    return data;
  }

  /**
   * Delete a product variation.
   */
  async deleteProductVariation(productId: number, variationId: number): Promise<WooVariation> {
    const { data } = await this.apiCall<WooVariation>(
      "DELETE",
      `/wp-json/wc/v3/products/${productId}/variations/${variationId}`,
      undefined,
      { force: "true" },
    );
    return data;
  }

  /**
   * List product categories.
   */
  async listProductCategories(
    page = 1,
    perPage = 100,
  ): Promise<{
    categories: Array<{
      id: number;
      name: string;
      slug: string;
      description?: string;
      parent?: number;
      count?: number;
    }>;
    pagination: PaginationHeaders;
  }> {
    const { data, pagination } = await this.apiCall<
      Array<{
        id: number;
        name: string;
        slug: string;
        description?: string;
        parent?: number;
        count?: number;
      }>
    >("GET", "/wp-json/wc/v3/products/categories", undefined, { page, per_page: perPage });
    return { categories: data, pagination };
  }

  /**
   * List product tags.
   */
  async listProductTags(
    page = 1,
    perPage = 100,
  ): Promise<{
    tags: Array<{ id: number; name: string; slug: string; count?: number }>;
    pagination: PaginationHeaders;
  }> {
    const { data, pagination } = await this.apiCall<
      Array<{ id: number; name: string; slug: string; count?: number }>
    >("GET", "/wp-json/wc/v3/products/tags", undefined, { page, per_page: perPage });
    return { tags: data, pagination };
  }

  /**
   * List product attributes.
   */
  async listProductAttributes(): Promise<
    Array<{ id: number; name: string; slug: string; type: string }>
  > {
    const { data } = await this.apiCall<
      Array<{ id: number; name: string; slug: string; type: string }>
    >("GET", "/wp-json/wc/v3/products/attributes");
    return data;
  }

  /**
   * List product reviews.
   */
  async listProductReviews(
    productId: number,
    page = 1,
    perPage = 100,
  ): Promise<{
    reviews: Array<{
      id: number;
      product_id: number;
      status: string;
      reviewer: string;
      reviewer_email: string;
      review: string;
      rating: number;
      date_created: string;
    }>;
    pagination: PaginationHeaders;
  }> {
    const { data, pagination } = await this.apiCall<
      Array<{
        id: number;
        product_id: number;
        status: string;
        reviewer: string;
        reviewer_email: string;
        review: string;
        rating: number;
        date_created: string;
      }>
    >("GET", `/wp-json/wc/v3/products/${productId}/reviews`, undefined, { page, per_page: perPage });
    return { reviews: data, pagination };
  }

  // ── ORDERS ──────────────────────────────────────────────────────

  /**
   * List orders with optional filters.
   */
  async listOrders(
    page = 1,
    perPage = 100,
    filters?: {
      status?: string;
      customer?: number;
      after?: string;
      before?: string;
    },
  ): Promise<{ orders: WooOrder[]; pagination: PaginationHeaders }> {
    const params: Record<string, string | number | boolean> = {
      page,
      per_page: perPage,
    };

    if (filters?.status) params.status = filters.status;
    if (filters?.customer) params.customer = filters.customer;
    if (filters?.after) params.after = filters.after;
    if (filters?.before) params.before = filters.before;

    const { data, pagination } = await this.apiCall<WooOrder[]>(
      "GET",
      "/wp-json/wc/v3/orders",
      undefined,
      params,
    );

    return { orders: data, pagination };
  }

  /**
   * Get a single order.
   */
  async getOrder(orderId: number): Promise<WooOrder> {
    const { data } = await this.apiCall<WooOrder>("GET", `/wp-json/wc/v3/orders/${orderId}`);
    return data;
  }

  /**
   * Create an order.
   */
  async createOrder(order: Partial<WooOrder>): Promise<WooOrder> {
    const { data } = await this.apiCall<WooOrder>("POST", "/wp-json/wc/v3/orders", order);
    return data;
  }

  /**
   * Update an order.
   */
  async updateOrder(orderId: number, updates: Partial<WooOrder>): Promise<WooOrder> {
    const { data } = await this.apiCall<WooOrder>(
      "PUT",
      `/wp-json/wc/v3/orders/${orderId}`,
      updates,
    );
    return data;
  }

  /**
   * Add a note to an order.
   */
  async addOrderNote(
    orderId: number,
    note: string,
    customerNote = false,
  ): Promise<{ id: number; note: string; customer_note: boolean }> {
    const { data } = await this.apiCall<{ id: number; note: string; customer_note: boolean }>(
      "POST",
      `/wp-json/wc/v3/orders/${orderId}/notes`,
      { note, customer_note: customerNote },
    );
    return data;
  }

  /**
   * Create a refund for an order.
   */
  async createOrderRefund(
    orderId: number,
    data?: {
      amount?: string;
      reason?: string;
      line_items?: Array<{ id: number; quantity: number }>;
      api_refund?: boolean;
    },
  ): Promise<WooRefund> {
    const { data: refund } = await this.apiCall<WooRefund>(
      "POST",
      `/wp-json/wc/v3/orders/${orderId}/refunds`,
      data,
    );
    return refund;
  }

  // ── CUSTOMERS ───────────────────────────────────────────────────

  /**
   * List customers.
   */
  async listCustomers(
    page = 1,
    perPage = 100,
    filters?: { search?: string; role?: string },
  ): Promise<{ customers: WooCustomer[]; pagination: PaginationHeaders }> {
    const params: Record<string, string | number | boolean> = {
      page,
      per_page: perPage,
    };

    if (filters?.search) params.search = filters.search;
    if (filters?.role) params.role = filters.role;

    const { data, pagination } = await this.apiCall<WooCustomer[]>(
      "GET",
      "/wp-json/wc/v3/customers",
      undefined,
      params,
    );

    return { customers: data, pagination };
  }

  /**
   * Get a single customer.
   */
  async getCustomer(customerId: number): Promise<WooCustomer> {
    const { data } = await this.apiCall<WooCustomer>(
      "GET",
      `/wp-json/wc/v3/customers/${customerId}`,
    );
    return data;
  }

  /**
   * Create a customer.
   */
  async createCustomer(customer: Partial<WooCustomer>): Promise<WooCustomer> {
    const { data } = await this.apiCall<WooCustomer>(
      "POST",
      "/wp-json/wc/v3/customers",
      customer,
    );
    return data;
  }

  /**
   * Update a customer.
   */
  async updateCustomer(customerId: number, updates: Partial<WooCustomer>): Promise<WooCustomer> {
    const { data } = await this.apiCall<WooCustomer>(
      "PUT",
      `/wp-json/wc/v3/customers/${customerId}`,
      updates,
    );
    return data;
  }

  /**
   * Delete a customer.
   */
  async deleteCustomer(customerId: number): Promise<WooCustomer> {
    const { data } = await this.apiCall<WooCustomer>(
      "DELETE",
      `/wp-json/wc/v3/customers/${customerId}`,
      undefined,
      { force: "true" },
    );
    return data;
  }

  /**
   * List customer downloads.
   */
  async listCustomerDownloads(customerId: number): Promise<
    Array<{
      download_id: string;
      download_name: string;
      product_id: number;
      product_name: string;
      downloads_remaining: string;
      access_expires: string;
      file: {
        name: string;
        file: string;
      };
    }>
  > {
    const { data } = await this.apiCall<
      Array<{
        download_id: string;
        download_name: string;
        product_id: number;
        product_name: string;
        downloads_remaining: string;
        access_expires: string;
        file: {
          name: string;
          file: string;
        };
      }>
    >("GET", `/wp-json/wc/v3/customers/${customerId}/downloads`);
    return data;
  }

  // ── COUPONS ─────────────────────────────────────────────────────

  /**
   * List coupons.
   */
  async listCoupons(
    page = 1,
    perPage = 100,
    filters?: { search?: string; code?: string },
  ): Promise<{ coupons: WooCoupon[]; pagination: PaginationHeaders }> {
    const params: Record<string, string | number | boolean> = {
      page,
      per_page: perPage,
    };

    if (filters?.search) params.search = filters.search;
    if (filters?.code) params.code = filters.code;

    const { data, pagination } = await this.apiCall<WooCoupon[]>(
      "GET",
      "/wp-json/wc/v3/coupons",
      undefined,
      params,
    );

    return { coupons: data, pagination };
  }

  /**
   * Get a single coupon.
   */
  async getCoupon(couponId: number): Promise<WooCoupon> {
    const { data } = await this.apiCall<WooCoupon>("GET", `/wp-json/wc/v3/coupons/${couponId}`);
    return data;
  }

  /**
   * Create a coupon.
   */
  async createCoupon(coupon: Partial<WooCoupon>): Promise<WooCoupon> {
    const { data } = await this.apiCall<WooCoupon>("POST", "/wp-json/wc/v3/coupons", coupon);
    return data;
  }

  /**
   * Update a coupon.
   */
  async updateCoupon(couponId: number, updates: Partial<WooCoupon>): Promise<WooCoupon> {
    const { data } = await this.apiCall<WooCoupon>(
      "PUT",
      `/wp-json/wc/v3/coupons/${couponId}`,
      updates,
    );
    return data;
  }

  /**
   * Delete a coupon.
   */
  async deleteCoupon(couponId: number): Promise<WooCoupon> {
    const { data } = await this.apiCall<WooCoupon>(
      "DELETE",
      `/wp-json/wc/v3/coupons/${couponId}`,
      undefined,
      { force: "true" },
    );
    return data;
  }

  // ── SHIPPING ────────────────────────────────────────────────────

  /**
   * List shipping zones.
   */
  async listShippingZones(): Promise<WooShippingZone[]> {
    const { data } = await this.apiCall<WooShippingZone[]>(
      "GET",
      "/wp-json/wc/v3/shipping/zones",
    );
    return data;
  }

  /**
   * Get a shipping zone.
   */
  async getShippingZone(zoneId: number): Promise<WooShippingZone> {
    const { data } = await this.apiCall<WooShippingZone>(
      "GET",
      `/wp-json/wc/v3/shipping/zones/${zoneId}`,
    );
    return data;
  }

  /**
   * Create a shipping zone.
   */
  async createShippingZone(zone: Partial<WooShippingZone>): Promise<WooShippingZone> {
    const { data } = await this.apiCall<WooShippingZone>(
      "POST",
      "/wp-json/wc/v3/shipping/zones",
      zone,
    );
    return data;
  }

  /**
   * Update a shipping zone.
   */
  async updateShippingZone(
    zoneId: number,
    updates: Partial<WooShippingZone>,
  ): Promise<WooShippingZone> {
    const { data } = await this.apiCall<WooShippingZone>(
      "PUT",
      `/wp-json/wc/v3/shipping/zones/${zoneId}`,
      updates,
    );
    return data;
  }

  /**
   * Delete a shipping zone.
   */
  async deleteShippingZone(zoneId: number): Promise<WooShippingZone> {
    const { data } = await this.apiCall<WooShippingZone>(
      "DELETE",
      `/wp-json/wc/v3/shipping/zones/${zoneId}`,
      undefined,
      { force: "true" },
    );
    return data;
  }

  /**
   * List shipping methods for a zone.
   */
  async listShippingMethods(
    zoneId: number,
  ): Promise<WooShippingMethod[]> {
    const { data } = await this.apiCall<WooShippingMethod[]>(
      "GET",
      `/wp-json/wc/v3/shipping/zones/${zoneId}/methods`,
    );
    return data;
  }

  /**
   * Get a shipping method.
   */
  async getShippingMethod(zoneId: number, methodId: string): Promise<WooShippingMethod> {
    const { data } = await this.apiCall<WooShippingMethod>(
      "GET",
      `/wp-json/wc/v3/shipping/zones/${zoneId}/methods/${methodId}`,
    );
    return data;
  }

  /**
   * Create a shipping method.
   */
  async createShippingMethod(
    zoneId: number,
    method: Partial<WooShippingMethod>,
  ): Promise<WooShippingMethod> {
    const { data } = await this.apiCall<WooShippingMethod>(
      "POST",
      `/wp-json/wc/v3/shipping/zones/${zoneId}/methods`,
      method,
    );
    return data;
  }

  /**
   * Update a shipping method.
   */
  async updateShippingMethod(
    zoneId: number,
    methodId: string,
    updates: Partial<WooShippingMethod>,
  ): Promise<WooShippingMethod> {
    const { data } = await this.apiCall<WooShippingMethod>(
      "PUT",
      `/wp-json/wc/v3/shipping/zones/${zoneId}/methods/${methodId}`,
      updates,
    );
    return data;
  }

  /**
   * Delete a shipping method.
   */
  async deleteShippingMethod(zoneId: number, methodId: string): Promise<WooShippingMethod> {
    const { data } = await this.apiCall<WooShippingMethod>(
      "DELETE",
      `/wp-json/wc/v3/shipping/zones/${zoneId}/methods/${methodId}`,
    );
    return data;
  }

  /**
   * List shipping classes.
   */
  async listShippingClasses(): Promise<
    Array<{
      id: number;
      name: string;
      slug: string;
      description: string;
    }>
  > {
    const { data } = await this.apiCall<
      Array<{
        id: number;
        name: string;
        slug: string;
        description: string;
      }>
    >("GET", "/wp-json/wc/v3/shipping/classes");
    return data;
  }

  // ── TAX ─────────────────────────────────────────────────────────

  /**
   * List tax rates.
   */
  async listTaxRates(
    page = 1,
    perPage = 100,
  ): Promise<{ rates: WooTaxRate[]; pagination: PaginationHeaders }> {
    const { data, pagination } = await this.apiCall<WooTaxRate[]>(
      "GET",
      "/wp-json/wc/v3/taxes",
      undefined,
      { page, per_page: perPage },
    );
    return { rates: data, pagination };
  }

  /**
   * Get a tax rate.
   */
  async getTaxRate(taxId: number): Promise<WooTaxRate> {
    const { data } = await this.apiCall<WooTaxRate>("GET", `/wp-json/wc/v3/taxes/${taxId}`);
    return data;
  }

  /**
   * Create a tax rate.
   */
  async createTaxRate(rate: Partial<WooTaxRate>): Promise<WooTaxRate> {
    const { data } = await this.apiCall<WooTaxRate>("POST", "/wp-json/wc/v3/taxes", rate);
    return data;
  }

  /**
   * Update a tax rate.
   */
  async updateTaxRate(taxId: number, updates: Partial<WooTaxRate>): Promise<WooTaxRate> {
    const { data } = await this.apiCall<WooTaxRate>(
      "PUT",
      `/wp-json/wc/v3/taxes/${taxId}`,
      updates,
    );
    return data;
  }

  /**
   * Delete a tax rate.
   */
  async deleteTaxRate(taxId: number): Promise<WooTaxRate> {
    const { data } = await this.apiCall<WooTaxRate>(
      "DELETE",
      `/wp-json/wc/v3/taxes/${taxId}`,
      undefined,
      { force: "true" },
    );
    return data;
  }

  /**
   * List tax classes.
   */
  async listTaxClasses(): Promise<Array<{ slug: string; name: string }>> {
    const { data } = await this.apiCall<Array<{ slug: string; name: string }>>(
      "GET",
      "/wp-json/wc/v3/taxes/classes",
    );
    return data;
  }

  // ── REPORTS ────────────────────────────────────────────────────

  /**
   * Get sales report.
   */
  async getSalesReport(
    period: "day" | "week" | "month" | "year" = "month",
    after?: string,
    before?: string,
  ): Promise<WooReport[]> {
    const params: Record<string, string | number | boolean> = { period };
    if (after) params.after = after;
    if (before) params.before = before;

    const { data } = await this.apiCall<WooReport[]>(
      "GET",
      "/wp-json/wc/v3/reports/sales",
      undefined,
      params,
    );
    return data;
  }

  /**
   * Get top sellers report.
   */
  async getTopSellersReport(limit = 10): Promise<
    Array<{
      product_id: number;
      product_name: string;
      quantity: number;
    }>
  > {
    const { data } = await this.apiCall<
      Array<{
        product_id: number;
        product_name: string;
        quantity: number;
      }>
    >("GET", "/wp-json/wc/v3/reports/top_sellers", undefined, { limit });
    return data;
  }

  /**
   * Get order total summary.
   */
  async getOrdersReport(): Promise<{
    total_orders: number;
    total_revenue: string;
    average_order_value: string;
  }> {
    const { data } = await this.apiCall<{
      total_orders: number;
      total_revenue: string;
      average_order_value: string;
    }>("GET", "/wp-json/wc/v3/reports/orders");
    return data;
  }

  // ── WEBHOOKS ────────────────────────────────────────────────────

  /**
   * List webhooks.
   */
  async listWebhooks(
    page = 1,
    perPage = 100,
  ): Promise<{ webhooks: WooWebhook[]; pagination: PaginationHeaders }> {
    const { data, pagination } = await this.apiCall<WooWebhook[]>(
      "GET",
      "/wp-json/wc/v3/webhooks",
      undefined,
      { page, per_page: perPage },
    );
    return { webhooks: data, pagination };
  }

  /**
   * Get a webhook.
   */
  async getWebhook(webhookId: number): Promise<WooWebhook> {
    const { data } = await this.apiCall<WooWebhook>(
      "GET",
      `/wp-json/wc/v3/webhooks/${webhookId}`,
    );
    return data;
  }

  /**
   * Create a webhook.
   */
  async createWebhook(webhook: Partial<WooWebhook>): Promise<WooWebhook> {
    const { data } = await this.apiCall<WooWebhook>(
      "POST",
      "/wp-json/wc/v3/webhooks",
      webhook,
    );
    return data;
  }

  /**
   * Update a webhook.
   */
  async updateWebhook(webhookId: number, updates: Partial<WooWebhook>): Promise<WooWebhook> {
    const { data } = await this.apiCall<WooWebhook>(
      "PUT",
      `/wp-json/wc/v3/webhooks/${webhookId}`,
      updates,
    );
    return data;
  }

  /**
   * Delete a webhook.
   */
  async deleteWebhook(webhookId: number): Promise<WooWebhook> {
    const { data } = await this.apiCall<WooWebhook>(
      "DELETE",
      `/wp-json/wc/v3/webhooks/${webhookId}`,
      undefined,
      { force: "true" },
    );
    return data;
  }

  // ── SETTINGS ────────────────────────────────────────────────────

  /**
   * Get WooCommerce settings.
   */
  async getSettings(
    group?: string,
  ): Promise<Array<{ id: string; label: string; value: unknown }>> {
    const params: Record<string, string | number | boolean> = {};
    if (group) {
      params.group = group;
    }
    const { data } = await this.apiCall<Array<{ id: string; label: string; value: unknown }>>(
      "GET",
      "/wp-json/wc/v3/settings",
      undefined,
      params,
    );
    return data;
  }

  /**
   * Update a setting.
   */
  async updateSetting(
    settingId: string,
    value: unknown,
  ): Promise<{ id: string; label: string; value: unknown }> {
    const { data } = await this.apiCall<{ id: string; label: string; value: unknown }>(
      "PUT",
      `/wp-json/wc/v3/settings/general/${settingId}`,
      { value },
    );
    return data;
  }

  // ── SYSTEM STATUS ───────────────────────────────────────────────

  /**
   * Get WooCommerce system status.
   */
  async getSystemStatus(): Promise<WooSystemStatus> {
    const { data } = await this.apiCall<WooSystemStatus>(
      "GET",
      "/wp-json/wc/v3/system_status",
    );
    return data;
  }

  /**
   * Get store info (home URL, site URL, etc.).
   */
  async getStoreInfo(): Promise<{
    home_url: string;
    site_url: string;
    store_name: string;
    store_email: string;
  }> {
    const { data } = await this.apiCall<{
      home_url: string;
      site_url: string;
      store_name: string;
      store_email: string;
    }>("GET", "/wp-json/wc/v3/system_status");

    return data;
  }
}

// ── Refund Type (used in order operations) ──────────────────────

export interface WooRefund {
  id: number;
  order_id: number;
  refund_id?: number;
  created_via?: string;
  amount: string;
  reason?: string;
  date_created: string;
  meta_data?: Array<{ key: string; value: unknown }>;
  line_items?: WooOrderLineItem[];
}

export default WooClient;
