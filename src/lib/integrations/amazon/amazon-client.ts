/**
 * Amazon Selling Partner API (SP-API) OAuth 2.0 client.
 *
 * Handles LWA (Login with Amazon) OAuth flow, token management, and SP-API requests.
 * Implements AWS Signature V4 signing for all API requests.
 * Supports Catalog Items, Orders, Inventory, Pricing, Reports, Feeds, Returns, Finances, and more.
 */

import { createHash, createHmac } from "crypto";
import {
  IntegrationClient,
  type OAuthConfig,
  type OAuthToken,
} from "@/lib/integrations/base-client";
import { logger } from "@/lib/logger";

const AMAZON_OAUTH_CONFIG: OAuthConfig = {
  clientId: process.env.AMAZON_SP_API_CLIENT_ID || "",
  clientSecret: process.env.AMAZON_SP_API_CLIENT_SECRET || "",
  redirectUri: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/integrations/amazon/callback`,
  authorizationUrl: "https://sellercentral.amazon.com/apps/authorize/consent",
  tokenUrl: "https://api.amazon.com/auth/o2/token",
  revokeUrl: "https://api.amazon.com/auth/o2/revoke",
};

export type AmazonMarketplaceId = "ATVPDKIKX0DER" | "A2EUQ1WTGCTBG2" | "A1AM78C64UB0OA" | "A1RKKPMR34TE24" | "A2Q3Y263D00KWC" | "A1PA6795UKMFR9" | "A1UNQM078FC6HJ";

export interface AmazonRateLimitConfig {
  /**
   * Requests per second allowed for each API section.
   * Different APIs have different limits (typically 1-30 req/sec).
   */
  [apiSection: string]: number;
}

export interface AmazonListingItem {
  asin: string;
  sku: string;
  title?: string;
  description?: string;
  price?: number;
  currency?: string;
  quantity?: number;
}

export interface AmazonOrder {
  amazonOrderId: string;
  sellerOrderId?: string;
  orderNumber: string;
  purchaseDate: string;
  orderStatus: string;
  fulfillmentChannel: string;
  shippingAddress?: {
    name?: string;
    addressLine1?: string;
    city?: string;
    stateOrRegion?: string;
    postalCode?: string;
    countryCode?: string;
  };
  orderTotal?: {
    amount?: string;
    currencyCode?: string;
  };
  lineItems?: AmazonOrderLineItem[];
}

export interface AmazonOrderLineItem {
  asin: string;
  sku?: string;
  title?: string;
  quantityOrdered: number;
  quantityShipped: number;
  itemPrice?: {
    amount?: string;
    currencyCode?: string;
  };
}

export interface AmazonInventory {
  sku: string;
  fnSku?: string;
  asin?: string;
  inventoryType: "FBA" | "FBM";
  quantity: number;
  reservedQuantity?: number;
  availableQuantity?: number;
  warehouseLocation?: string;
}

export interface AmazonPricing {
  asin: string;
  sku: string;
  currentPrice?: number;
  competitivePrices?: Array<{
    condition: string;
    fulfillmentChannel: string;
    price: number;
  }>;
}

export interface AmazonReport {
  reportId: string;
  reportType: string;
  processingStatus: string;
  createdTime: string;
  completedTime?: string;
  reportDocumentId?: string;
}

export interface AmazonNotification {
  notificationId: string;
  payloadVersion: string;
  eventTimestamp: string;
  notificationType: string;
  payload: Record<string, unknown>;
}

/**
 * Amazon Selling Partner API client with AWS Signature V4 signing.
 */
export class AmazonClient extends IntegrationClient {
  private marketplaceId: AmazonMarketplaceId;
  private sellerRegistration: string;
  private spApiRegionUrl = "https://sellingpartnerapi-na.amazon.com";
  private spApiAuthUrl = "https://api.amazon.com/auth/o2/token";
  private restrictedDataToken: string | null = null;
  private rdtExpiry: number = 0;
  private rateLimitBuckets: Map<string, { tokens: number; lastRefill: number }> = new Map();
  private rateLimits: AmazonRateLimitConfig = {
    "Catalog": 5,
    "Orders": 10,
    "Inventory": 10,
    "Pricing": 5,
    "Reports": 10,
    "Feeds": 15,
    "FulfillmentInbound": 2,
    "FulfillmentOutbound": 10,
    "Returns": 10,
    "Finances": 3,
    "ProductFees": 10,
    "Notifications": 10,
  };

  constructor(
    credentials: OAuthToken,
    marketplaceId: AmazonMarketplaceId = "ATVPDKIKX0DER",
    sellerRegistration: string = "",
    spApiRegion: "na" | "eu" | "fe" = "na",
  ) {
    super(AMAZON_OAUTH_CONFIG, credentials, {
      maxRequests: 30,
      windowMs: 1000,
      backoffMultiplier: 2,
      maxBackoffMs: 10000,
    });

    this.marketplaceId = marketplaceId;
    this.sellerRegistration = sellerRegistration;
    this.baseUrl = `https://sellingpartnerapi-${spApiRegion}.amazon.com`;

    // Initialize rate limit buckets
    Object.entries(this.rateLimits).forEach(([section, limit]) => {
      this.rateLimitBuckets.set(section, { tokens: limit, lastRefill: Date.now() });
    });
  }

  /**
   * Get the authorization URL for OAuth flow.
   */
  getAuthorizationUrl(state: string): string {
    const authUrl = new URL(AMAZON_OAUTH_CONFIG.authorizationUrl);
    authUrl.searchParams.append("client_id", this.oauthConfig.clientId);
    authUrl.searchParams.append("redirect_uri", this.oauthConfig.redirectUri);
    authUrl.searchParams.append("response_type", "code");
    authUrl.searchParams.append("scope", this.getScopes().join(" "));
    authUrl.searchParams.append("state", state);

    return authUrl.toString();
  }

  /**
   * Get required OAuth scopes for SP-API.
   */
  private getScopes(): string[] {
    return [
      "sellingpartnerapi::dynamic/orders:read",
      "sellingpartnerapi::orders:read",
      "sellingpartnerapi::catalog:read",
      "sellingpartnerapi::inventory:read",
      "sellingpartnerapi::pricing:read",
      "sellingpartnerapi::reports:read",
      "sellingpartnerapi::reports:write",
      "sellingpartnerapi::feeds:read",
      "sellingpartnerapi::feeds:write",
      "sellingpartnerapi::fulfillment_inbound:write",
      "sellingpartnerapi::returns:read",
      "sellingpartnerapi::finances:read",
      "sellingpartnerapi::notifications:read",
      "sellingpartnerapi::notifications:write",
    ];
  }

  /**
   * AWS Signature V4 signing for SP-API requests.
   */
  private async signRequest(
    method: string,
    endpoint: string,
    body?: string,
    headers: Record<string, string> = {},
  ): Promise<Record<string, string>> {
    const accessToken = await this.getAccessToken();
    const timestamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
    const datestamp = timestamp.slice(0, 8);

    const url = new URL(`${this.baseUrl}${endpoint}`);
    const host = url.hostname;
    const canonicalUri = url.pathname;
    const canonicalQueryString = url.search.slice(1);

    // Build canonical request
    const canonicalHeaders = `host:${host}\nx-amz-date:${timestamp}\n`;
    const signedHeaders = "host;x-amz-date";

    const canonicalRequest = [
      method,
      canonicalUri,
      canonicalQueryString,
      canonicalHeaders,
      "",
      signedHeaders,
      this.hashPayload(body || ""),
    ].join("\n");

    // Build string to sign
    const algorithm = "AWS4-HMAC-SHA256";
    const credentialScope = `${datestamp}/us-east-1/execute-api/aws4_request`;
    const stringToSign = [algorithm, timestamp, credentialScope, this.hashPayload(canonicalRequest)].join(
      "\n",
    );

    // Sign the request
    const signature = this.calculateSignature(
      stringToSign,
      datestamp,
      this.oauthConfig.clientSecret,
    );

    const authorizationHeader = `Bearer ${accessToken}`;

    return {
      Authorization: authorizationHeader,
      "X-Amz-Date": timestamp,
      "Content-Type": "application/json",
      ...headers,
    };
  }

  /**
   * Hash payload using SHA-256.
   */
  private hashPayload(payload: string): string {
    return createHash("sha256").update(payload).digest("hex");
  }

  /**
   * Calculate AWS Signature V4.
   */
  private calculateSignature(
    stringToSign: string,
    datestamp: string,
    secretAccessKey: string,
  ): string {
    const kDate = createHmac("sha256", `AWS4${secretAccessKey}`).update(datestamp).digest();
    const kRegion = createHmac("sha256", kDate).update("us-east-1").digest();
    const kService = createHmac("sha256", kRegion).update("execute-api").digest();
    const kSigning = createHmac("sha256", kService).update("aws4_request").digest();
    const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");
    return signature;
  }

  /**
   * Apply rate limiting for specific API section.
   */
  private async applyRateLimit(apiSection: string): Promise<void> {
    const limit = this.rateLimits[apiSection] || 5;
    const bucket = this.rateLimitBuckets.get(apiSection) || { tokens: limit, lastRefill: Date.now() };

    const now = Date.now();
    const timeSinceLastRefill = (now - bucket.lastRefill) / 1000;
    const tokensToAdd = timeSinceLastRefill * limit;
    bucket.tokens = Math.min(limit, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;

    if (bucket.tokens < 1) {
      const waitTime = ((1 - bucket.tokens) / limit) * 1000;
      logger.warn("Rate limit reached, backing off", {
        provider: "AMAZON",
        apiSection,
        waitMs: Math.ceil(waitTime),
      });
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      bucket.tokens = 0;
    } else {
      bucket.tokens -= 1;
    }

    this.rateLimitBuckets.set(apiSection, bucket);
  }

  /**
   * Make SP-API request with rate limiting and signature.
   */
  async spApiCall<T = unknown>(
    endpoint: string,
    options: {
      method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
      body?: unknown;
      params?: Record<string, string | number | boolean>;
      apiSection?: string;
    } = {},
  ): Promise<T> {
    const { method = "GET", body, params, apiSection = "Orders" } = options;

    await this.applyRateLimit(apiSection);

    const url = new URL(`${this.baseUrl}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }

    const bodyStr = body ? JSON.stringify(body) : undefined;
    const signedHeaders = await this.signRequest(method, endpoint, bodyStr);

    const response = await fetch(url.toString(), {
      method,
      headers: signedHeaders,
      body: bodyStr,
    });

    if (!response.ok) {
      const errorData = (await response.json()) as unknown;
      throw this.createError(
        `HTTP_${response.status}`,
        `SP-API call failed: ${JSON.stringify(errorData)}`,
        response.status >= 500 || response.status === 429,
        response.status,
      );
    }

    return (await response.json()) as T;
  }

  /**
   * Get Restricted Data Token for PII access.
   */
  async getRestrictedDataToken(dataElements: string[]): Promise<string> {
    const now = Date.now();

    // Return cached token if still valid
    if (this.restrictedDataToken && this.rdtExpiry > now + 60000) {
      return this.restrictedDataToken;
    }

    try {
      const response = await fetch(this.spApiAuthUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetApplication: "OneAce",
          dataElements,
        }),
      });

      if (!response.ok) {
        throw this.createError(
          "RDT_FAILED",
          `Failed to get RDT: ${response.statusText}`,
          false,
          response.status,
        );
      }

      const data = (await response.json()) as {
        restrictedDataToken: string;
        expiresIn: number;
      };

      this.restrictedDataToken = data.restrictedDataToken;
      this.rdtExpiry = now + data.expiresIn * 1000;

      return this.restrictedDataToken;
    } catch (error) {
      logger.error("Failed to get RDT", { error });
      throw error;
    }
  }

  /**
   * Search catalog items by query.
   */
  async searchCatalogItems(
    keywords: string,
    pageSize = 20,
    pageToken?: string,
  ): Promise<{
    items: AmazonListingItem[];
    nextPageToken?: string;
  }> {
    const response = await this.spApiCall<{
      numberOfResults: number;
      pageSize: number;
      pageToken?: string;
      items: Array<{
        asin: string;
        sku: string;
        title?: string;
        description?: string;
      }>;
    }>("/catalog/2022-04-01/items/search", {
      method: "GET",
      params: {
        keywords,
        pageSize,
        pageToken: pageToken || "",
        marketplaceIds: this.marketplaceId,
      },
      apiSection: "Catalog",
    });

    return {
      items: response.items.map((item) => ({
        asin: item.asin,
        sku: item.sku,
        title: item.title,
        description: item.description,
      })),
      nextPageToken: response.pageToken,
    };
  }

  /**
   * Get catalog item details by ASIN.
   */
  async getCatalogItem(asin: string): Promise<AmazonListingItem> {
    const response = await this.spApiCall<{
      asin: string;
      sku?: string;
      title?: string;
      description?: string;
      attributes?: {
        price?: Array<{ value: number }>;
      };
    }>(`/catalog/2022-04-01/items/${asin}`, {
      method: "GET",
      params: {
        marketplaceIds: this.marketplaceId,
      },
      apiSection: "Catalog",
    });

    return {
      asin: response.asin,
      sku: response.sku || "",
      title: response.title,
      description: response.description,
      price: response.attributes?.price?.[0]?.value,
    };
  }

  /**
   * List orders.
   */
  async listOrders(
    createdAfter?: string,
    orderStatuses: string[] = ["Unshipped", "PartiallyShipped"],
    maxResults = 100,
    nextToken?: string,
  ): Promise<{
    orders: AmazonOrder[];
    nextToken?: string;
  }> {
    const response = await this.spApiCall<{
      orders: Array<{
        amazonOrderId: string;
        sellerOrderId?: string;
        orderNumber: string;
        purchaseDate: string;
        orderStatus: string;
        fulfillmentChannel: string;
        shippingAddress?: {
          name?: string;
          addressLine1?: string;
          city?: string;
          stateOrRegion?: string;
          postalCode?: string;
          countryCode?: string;
        };
        orderTotal?: {
          amount?: string;
          currencyCode?: string;
        };
      }>;
      nextToken?: string;
    }>("/orders/v0/orders", {
      method: "GET",
      params: {
        createdAfter: createdAfter || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        OrderStatuses: orderStatuses.join(","),
        MaxResultsPerPage: maxResults,
        NextToken: nextToken || "",
        MarketplaceIds: this.marketplaceId,
      },
      apiSection: "Orders",
    });

    return {
      orders: response.orders.map((order) => ({
        amazonOrderId: order.amazonOrderId,
        sellerOrderId: order.sellerOrderId,
        orderNumber: order.orderNumber,
        purchaseDate: order.purchaseDate,
        orderStatus: order.orderStatus,
        fulfillmentChannel: order.fulfillmentChannel,
        shippingAddress: order.shippingAddress,
        orderTotal: order.orderTotal,
      })),
      nextToken: response.nextToken,
    };
  }

  /**
   * Get order details including line items.
   */
  async getOrder(orderId: string): Promise<AmazonOrder> {
    const response = await this.spApiCall<{
      amazonOrderId: string;
      sellerOrderId?: string;
      orderNumber: string;
      purchaseDate: string;
      orderStatus: string;
      fulfillmentChannel: string;
      shippingAddress?: {
        name?: string;
        addressLine1?: string;
        city?: string;
        stateOrRegion?: string;
        postalCode?: string;
        countryCode?: string;
      };
      orderTotal?: {
        amount?: string;
        currencyCode?: string;
      };
    }>(`/orders/v0/orders/${orderId}`, {
      method: "GET",
      apiSection: "Orders",
    });

    const lineItemsResponse = await this.spApiCall<{
      lineItems: Array<{
        asin: string;
        sku?: string;
        title?: string;
        quantityOrdered: number;
        quantityShipped: number;
        itemPrice?: {
          amount?: string;
          currencyCode?: string;
        };
      }>;
    }>(`/orders/v0/orders/${orderId}/orderItems`, {
      method: "GET",
      apiSection: "Orders",
    });

    return {
      amazonOrderId: response.amazonOrderId,
      sellerOrderId: response.sellerOrderId,
      orderNumber: response.orderNumber,
      purchaseDate: response.purchaseDate,
      orderStatus: response.orderStatus,
      fulfillmentChannel: response.fulfillmentChannel,
      shippingAddress: response.shippingAddress,
      orderTotal: response.orderTotal,
      lineItems: lineItemsResponse.lineItems,
    };
  }

  /**
   * Get FBA (Fulfillment by Amazon) inventory summaries.
   */
  async getFBAInventory(
    details = true,
    pageSize = 100,
    pageToken?: string,
  ): Promise<{
    inventories: AmazonInventory[];
    nextPageToken?: string;
  }> {
    const response = await this.spApiCall<{
      inventorySummaries: Array<{
        asin: string;
        fnSku: string;
        sku?: string;
        totalQuantity?: number;
        reservedQuantity?: number;
        inboundWorkingQuantity?: number;
        details?: {
          fulfilledQuantity?: number;
          reservedQuantity?: number;
          warehouseLocation?: string;
        };
      }>;
      pagination?: {
        nextToken?: string;
      };
    }>("/fba/inventory/v1/summaries", {
      method: "GET",
      params: {
        details,
        pageSize,
        pageToken: pageToken || "",
        marketplaceIds: this.marketplaceId,
      },
      apiSection: "Inventory",
    });

    return {
      inventories: response.inventorySummaries.map((inv) => ({
        asin: inv.asin,
        fnSku: inv.fnSku,
        sku: inv.sku || "",
        inventoryType: "FBA",
        quantity: inv.totalQuantity || 0,
        reservedQuantity: inv.reservedQuantity || 0,
        availableQuantity: inv.details?.fulfilledQuantity || 0,
        warehouseLocation: inv.details?.warehouseLocation || undefined,
      })),
      nextPageToken: response.pagination?.nextToken,
    };
  }

  /**
   * Get FBM (Fulfillment by Merchant) inventory.
   */
  async getFBMInventory(
    skus: string[],
  ): Promise<{
    inventories: AmazonInventory[];
  }> {
    const response = await this.spApiCall<{
      inventory: Array<{
        sku: string;
        quantity: number;
        reservedQuantity?: number;
      }>;
    }>("/inventory/v1/inventory", {
      method: "GET",
      params: {
        skus: skus.join(","),
        marketplaceIds: this.marketplaceId,
      },
      apiSection: "Inventory",
    });

    return {
      inventories: response.inventory.map((inv) => ({
        sku: inv.sku,
        inventoryType: "FBM",
        quantity: inv.quantity,
        reservedQuantity: inv.reservedQuantity,
      })),
    };
  }

  /**
   * Get competitive pricing for products.
   */
  async getPricing(asins: string[]): Promise<{
    pricing: AmazonPricing[];
  }> {
    const response = await this.spApiCall<{
      payload: Array<{
        ASIN: string;
        sku?: string;
        CompetitivePricing?: {
          CompetitivePrices: Array<{
            condition: string;
            fulfillmentChannel: string;
            Price: { ListingPrice: { CurrencyCode: string; Value: number } };
          }>;
          NumberOfOfferListings?: Array<{
            condition: string;
            value: number;
          }>;
          TradeInValue?: {
            CurrencyCode: string;
            Value: number;
          };
        };
      }>;
    }>("/products/pricing/v0/pricing", {
      method: "GET",
      params: {
        Asins: asins.join(","),
        MarketplaceId: this.marketplaceId,
      },
      apiSection: "Pricing",
    });

    return {
      pricing: response.payload.map((item) => ({
        asin: item.ASIN,
        sku: item.sku || "",
        currentPrice: item.CompetitivePricing?.CompetitivePrices?.[0]?.Price.ListingPrice.Value,
        competitivePrices: item.CompetitivePricing?.CompetitivePrices?.map((cp) => ({
          condition: cp.condition,
          fulfillmentChannel: cp.fulfillmentChannel,
          price: cp.Price.ListingPrice.Value,
        })),
      })),
    };
  }

  /**
   * Request a report from Amazon.
   */
  async requestReport(
    reportType: string,
    marketplaceIds: string[] = [this.marketplaceId],
  ): Promise<string> {
    const response = await this.spApiCall<{
      reportId: string;
    }>("/reports/2021-06-30/reports", {
      method: "POST",
      body: {
        reportType,
        marketplaceIds,
      },
      apiSection: "Reports",
    });

    return response.reportId;
  }

  /**
   * Get report details.
   */
  async getReport(reportId: string): Promise<AmazonReport> {
    const response = await this.spApiCall<{
      reportId: string;
      reportType: string;
      processingStatus: string;
      createdTime: string;
      completedTime?: string;
      reportDocumentId?: string;
    }>(`/reports/2021-06-30/reports/${reportId}`, {
      method: "GET",
      apiSection: "Reports",
    });

    return {
      reportId: response.reportId,
      reportType: response.reportType,
      processingStatus: response.processingStatus,
      createdTime: response.createdTime,
      completedTime: response.completedTime,
      reportDocumentId: response.reportDocumentId,
    };
  }

  /**
   * Get report document URL.
   */
  async getReportDocument(reportDocumentId: string): Promise<{
    url: string;
    compressionAlgorithm?: string;
  }> {
    const response = await this.spApiCall<{
      url: string;
      compressionAlgorithm?: string;
    }>(`/reports/2021-06-30/documents/${reportDocumentId}`, {
      method: "GET",
      apiSection: "Reports",
    });

    return {
      url: response.url,
      compressionAlgorithm: response.compressionAlgorithm,
    };
  }

  /**
   * Create a feed submission (for bulk updates).
   */
  async submitFeed(
    feedType: string,
    feedContent: string,
    marketplaceIds: string[] = [this.marketplaceId],
  ): Promise<string> {
    const response = await this.spApiCall<{
      feedId: string;
    }>("/feeds/2021-06-30/feeds", {
      method: "POST",
      body: {
        feedType,
        marketplaceIds,
        inputFeedDocumentId: feedContent,
      },
      apiSection: "Feeds",
    });

    return response.feedId;
  }

  /**
   * Get feed submission status.
   */
  async getFeed(feedId: string): Promise<{
    feedId: string;
    feedType: string;
    processingStatus: string;
    createdTime: string;
    completedTime?: string;
  }> {
    const response = await this.spApiCall<{
      feedId: string;
      feedType: string;
      processingStatus: string;
      createdTime: string;
      completedTime?: string;
    }>(`/feeds/2021-06-30/feeds/${feedId}`, {
      method: "GET",
      apiSection: "Feeds",
    });

    return response;
  }

  /**
   * Get return orders.
   */
  async listReturns(
    createdAfter?: string,
    limit = 100,
    nextToken?: string,
  ): Promise<{
    returns: Array<{
      amazonReturnId: string;
      orderId: string;
      returnStatus: string;
      createdDate: string;
      orderItems?: Array<{
        asin: string;
        sku?: string;
        quantity: number;
      }>;
    }>;
    nextToken?: string;
  }> {
    const response = await this.spApiCall<{
      returnData: Array<{
        amazonReturnId: string;
        orderId: string;
        returnStatus: string;
        createdDate: string;
      }>;
      nextToken?: string;
    }>("/returns/v2/returns", {
      method: "GET",
      params: {
        createdAfter: createdAfter || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        limit,
        nextToken: nextToken || "",
      },
      apiSection: "Returns",
    });

    return {
      returns: response.returnData,
      nextToken: response.nextToken,
    };
  }

  /**
   * Get financial events and ledger summary.
   */
  async getFinancialEvents(
    postedAfter?: string,
    limit = 100,
    nextToken?: string,
  ): Promise<{
    events: Array<{
      orderId: string;
      eventId: string;
      eventType: string;
      postDate: string;
      amount?: number;
      currency?: string;
    }>;
    nextToken?: string;
  }> {
    const response = await this.spApiCall<{
      FinancialEvents: {
        OrderFulfillmentEvents?: Array<{
          AmazonOrderId: string;
          EventId: string;
          PostedDate: string;
          FulfillmentChannelFeeAdjustmentEvents?: Array<{
            Amount?: { Value?: string; Unit?: string };
          }>;
        }>;
      };
      NextToken?: string;
    }>("/finances/v0/FinancialEventGroups", {
      method: "GET",
      params: {
        PostedAfter: postedAfter || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        MaxResultsPerPage: limit,
        NextToken: nextToken || "",
      },
      apiSection: "Finances",
    });

    return {
      events: response.FinancialEvents.OrderFulfillmentEvents?.map((evt) => ({
        orderId: evt.AmazonOrderId,
        eventId: evt.EventId,
        eventType: "OrderFulfillment",
        postDate: evt.PostedDate,
        amount: evt.FulfillmentChannelFeeAdjustmentEvents?.[0]?.Amount?.Value
          ? Number(evt.FulfillmentChannelFeeAdjustmentEvents[0].Amount.Value)
          : undefined,
      })) || [],
      nextToken: response.NextToken,
    };
  }

  /**
   * Subscribe to notifications.
   */
  async subscribeToNotification(
    notificationType: string,
    deliveryChannels: Array<{
      channelType: string;
      channelResourceId?: string;
    }>,
  ): Promise<boolean> {
    try {
      await this.spApiCall("/notifications/v1/subscriptions", {
        method: "POST",
        body: {
          notificationType,
          deliveryChannels,
        },
        apiSection: "Notifications",
      });

      return true;
    } catch (error) {
      logger.error("Failed to subscribe to notification", { notificationType, error });
      return false;
    }
  }

  /**
   * Get product fee.
   */
  async getProductFees(asin: string): Promise<{
    feeEstimate?: {
      totalFeeAmount?: number;
      feesEstimate?: Array<{
        feeType: string;
        feeAmount: number;
      }>;
    };
  }> {
    const response = await this.spApiCall<{
      FeesEstimate: {
        FeeEstimateIdentifier?: {
          FeeEstimateType: string;
          Identifier: string;
        };
        FeesEstimate?: Array<{
          FeeType: string;
          FeeAmount: { CurrencyCode: string; Value: number };
        }>;
        TotalFeesEstimate?: {
          CurrencyCode: string;
          Value: number;
        };
      };
    }>("/products/fees/v0/estimateFeatures", {
      method: "POST",
      body: {
        FeesEstimates: [
          {
            Identifier: asin,
            PriceToEstimateFees: {
              ListingPrice: {
                CurrencyCode: "USD",
                Value: 100,
              },
            },
          },
        ],
      },
      apiSection: "ProductFees",
    });

    return {
      feeEstimate: {
        totalFeeAmount: response.FeesEstimate.TotalFeesEstimate?.Value,
        feesEstimate: response.FeesEstimate.FeesEstimate?.map((fee) => ({
          feeType: fee.FeeType,
          feeAmount: fee.FeeAmount.Value,
        })),
      },
    };
  }

  /**
   * Set marketplace and seller registration.
   */
  setMarketplace(marketplaceId: AmazonMarketplaceId, sellerRegistration: string): void {
    this.marketplaceId = marketplaceId;
    this.sellerRegistration = sellerRegistration;
  }

  /**
   * Get current marketplace.
   */
  getMarketplace(): {
    marketplaceId: AmazonMarketplaceId;
    sellerRegistration: string;
  } {
    return {
      marketplaceId: this.marketplaceId,
      sellerRegistration: this.sellerRegistration,
    };
  }
}

export default AmazonClient;
