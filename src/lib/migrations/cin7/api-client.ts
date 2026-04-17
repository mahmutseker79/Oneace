/**
 * Phase MIG-S5 — Cin7 Core REST API v2 client.
 *
 * Cin7 Core (formerly DEAR Systems) API:
 * - Base: https://inventory.dearsystems.com/ExternalApi/v2/
 * - Auth: api-auth-accountid + api-auth-applicationkey headers
 * - Rate limit: 60 requests/minute (sliding window)
 * - Paging: Limit + Page query params (1-indexed)
 */

import { logger } from "@/lib/logger";

export interface Cin7Credentials {
  accountId: string;
  applicationKey: string;
}

export interface Cin7PagedResponse<T> {
  Page: number;
  Limit: number;
  Records: T[];
  Total: number;
}

export interface Cin7Product {
  ID: string;
  Name: string;
  SKU: string;
  Barcode?: string;
  Description?: string;
  UOM?: string;
  CostPrice?: number;
  SalePrice?: number;
  Status?: string;
  TaxRate?: number;
}

export interface Cin7Supplier {
  ID: string;
  Name: string;
  ContactName?: string;
  Email?: string;
  Phone?: string;
  Website?: string;
  Address?: string;
  AddressLine2?: string;
  City?: string;
  State?: string;
  Country?: string;
  Postcode?: string;
  Notes?: string;
  Currency?: string;
}

export interface Cin7Location {
  ID: string;
  Name: string;
  Code?: string;
  Address?: string;
  IsDefault?: boolean;
}

export interface Cin7StockItem {
  ID: string;
  ProductID: string;
  LocationID: string;
  QtyOnHand: number;
}

export interface Cin7Purchase {
  ID: string;
  PurchaseNumber: string;
  SupplierID: string;
  Status: string;
  OrderDate?: string;
  ExpectedDate?: string;
  Notes?: string;
  Lines: Cin7PurchaseLine[];
  Currency?: string;
}

export interface Cin7PurchaseLine {
  ID: string;
  ProductID: string;
  Quantity: number;
  UnitCost?: number;
}

export interface Cin7Attachment {
  ID: string;
  FileName: string;
  FileUrl: string;
  MimeType?: string;
}

/**
 * Sliding-window rate limiter for Cin7 (60 req/min).
 * Uses a deque of request timestamps to enforce the rate limit.
 */
class Cin7RateLimiter {
  private requests: number[] = [];
  private maxRequests = 60;
  private windowMs = 60000; // 1 minute

  async acquire(): Promise<void> {
    const now = Date.now();
    // Remove timestamps outside the window
    this.requests = this.requests.filter((t) => now - t < this.windowMs);

    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitMs = this.windowMs - (now - oldestRequest) + 10; // +10ms buffer
      logger.debug("Cin7: rate limit reached, waiting", { waitMs });
      await new Promise((resolve) => setTimeout(resolve, Math.max(0, waitMs)));
      return this.acquire(); // Retry after waiting
    }

    this.requests.push(now);
  }
}

/**
 * Exponential backoff retry policy for transient errors.
 * 5xx and 429 → retry; 4xx (except 429) → fail fast.
 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 5): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err as Error;

      // Check if retryable
      const isRetryable =
        err instanceof Cin7ApiError &&
        (err.statusCode === undefined || err.statusCode >= 500 || err.statusCode === 429);

      if (!isRetryable) {
        throw err;
      }

      // Exponential backoff: 250ms * 2^n, capped at 30s
      const backoffMs = Math.min(2 ** attempt * 250, 30000);
      logger.debug("Cin7: retrying after backoff", {
        attempt,
        backoffMs,
        error: err instanceof Error ? err.message : String(err),
      });

      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }

  throw lastError || new Error("Max retries exceeded");
}

export class Cin7ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public originalError?: Error,
  ) {
    super(message);
    this.name = "Cin7ApiError";
  }
}

export class Cin7ApiClient {
  private baseUrl = "https://inventory.dearsystems.com/ExternalApi/v2";
  private credentials: Cin7Credentials;
  private rateLimiter = new Cin7RateLimiter();

  constructor(credentials: Cin7Credentials) {
    this.credentials = credentials;
  }

  private async request<T>(
    endpoint: string,
    params: Record<string, string | number | boolean> = {},
  ): Promise<T> {
    await this.rateLimiter.acquire();

    const url = new URL(`${this.baseUrl}${endpoint}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }

    const headers: Record<string, string> = {
      "api-auth-accountid": this.credentials.accountId,
      "api-auth-applicationkey": this.credentials.applicationKey,
      "Content-Type": "application/json",
    };

    return withRetry(async () => {
      const response = await fetch(url.toString(), {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        const text = await response.text();
        const err = new Cin7ApiError(
          `Cin7 API error: ${response.status} ${response.statusText}`,
          response.status,
        );
        logger.error("Cin7 API request failed", {
          endpoint,
          status: response.status,
          error: text,
        });
        throw err;
      }

      return response.json() as Promise<T>;
    });
  }

  /**
   * Fetch all products, paginating until no more results.
   * Hard cap: 1000 pages to prevent infinite loops from malformed APIs.
   */
  async getAllProducts(): Promise<Cin7Product[]> {
    const results: Cin7Product[] = [];
    let page = 1;
    const maxPages = 1000;

    while (page <= maxPages) {
      const response = await this.request<Cin7PagedResponse<Cin7Product>>("/product", {
        Limit: 1000,
        Page: page,
      });

      results.push(...response.Records);

      if (response.Records.length < 1000 || page >= response.Total / 1000) {
        break;
      }

      page++;
    }

    return results;
  }

  /**
   * Fetch all suppliers, paginating until no more results.
   */
  async getAllSuppliers(): Promise<Cin7Supplier[]> {
    const results: Cin7Supplier[] = [];
    let page = 1;
    const maxPages = 1000;

    while (page <= maxPages) {
      const response = await this.request<Cin7PagedResponse<Cin7Supplier>>("/supplier", {
        Limit: 1000,
        Page: page,
      });

      results.push(...response.Records);

      if (response.Records.length < 1000) {
        break;
      }

      page++;
    }

    return results;
  }

  /**
   * Fetch all locations (warehouses in Cin7).
   */
  async getAllLocations(): Promise<Cin7Location[]> {
    const results: Cin7Location[] = [];
    let page = 1;
    const maxPages = 1000;

    while (page <= maxPages) {
      const response = await this.request<Cin7PagedResponse<Cin7Location>>("/location", {
        Limit: 1000,
        Page: page,
      });

      results.push(...response.Records);

      if (response.Records.length < 1000) {
        break;
      }

      page++;
    }

    return results;
  }

  /**
   * Fetch all stock items (on-hand by location).
   */
  async getAllStockItems(): Promise<Cin7StockItem[]> {
    const results: Cin7StockItem[] = [];
    let page = 1;
    const maxPages = 1000;

    while (page <= maxPages) {
      const response = await this.request<Cin7PagedResponse<Cin7StockItem>>("/stockItem", {
        Limit: 1000,
        Page: page,
      });

      results.push(...response.Records);

      if (response.Records.length < 1000) {
        break;
      }

      page++;
    }

    return results;
  }

  /**
   * Fetch purchase orders, optionally filtered by date.
   * If modifiedSince is provided, only POs modified after this date are returned.
   */
  async getAllPurchases(modifiedSince?: Date): Promise<Cin7Purchase[]> {
    const results: Cin7Purchase[] = [];
    let page = 1;
    const maxPages = 1000;

    const params: Record<string, string | number> = {
      Limit: 1000,
    };

    if (modifiedSince) {
      params.ModifiedSince = modifiedSince.toISOString();
    }

    while (page <= maxPages) {
      params.Page = page;
      const response = await this.request<Cin7PagedResponse<Cin7Purchase>>("/purchase", params);

      results.push(...response.Records);

      if (response.Records.length < 1000) {
        break;
      }

      page++;
    }

    return results;
  }

  /**
   * Fetch attachments for a specific product.
   */
  async getProductAttachments(productId: string): Promise<Cin7Attachment[]> {
    try {
      const response = await this.request<Cin7PagedResponse<Cin7Attachment>>(
        `/product/${productId}/attachment`,
        {
          Limit: 1000,
          Page: 1,
        },
      );

      return response.Records;
    } catch (err) {
      // If not found or error, return empty array
      logger.debug("Cin7: failed to fetch attachments", {
        productId,
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  }
}
