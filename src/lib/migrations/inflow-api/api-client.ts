/**
 * Phase MIG-S5 — inFlow Cloud REST API client.
 *
 * inFlow Cloud API:
 * - Base: https://cloudapi.inflowinventory.com/
 * - Auth: Authorization: Bearer <API_TOKEN> + companyId path segment
 * - Rate limit: 120 requests/minute (sliding window)
 * - Paging: cursor-based, no offset/limit (uses tokens)
 */

import { logger } from "@/lib/logger";

export interface InflowCredentials {
  apiToken: string;
  companyId: string;
}

export interface InflowCursoredResponse<T> {
  data: T[];
  cursor?: string;
  hasMore?: boolean;
}

export interface InflowProduct {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  description?: string;
  unit?: string;
  costPrice?: number;
  salePrice?: number;
  status?: string;
}

export interface InflowVendor {
  id: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  notes?: string;
}

export interface InflowLocation {
  id: string;
  name: string;
  code?: string;
  address?: string;
  isDefault?: boolean;
}

export interface InflowStockLevel {
  productId: string;
  locationId: string;
  quantity: number;
}

export interface InflowPurchaseOrder {
  id: string;
  poNumber: string;
  vendorId: string;
  status: string;
  orderDate?: string;
  expectedDate?: string;
  notes?: string;
  lines: InflowPurchaseOrderLine[];
}

export interface InflowPurchaseOrderLine {
  productId: string;
  quantity: number;
  unitCost?: number;
}

/**
 * Sliding-window rate limiter for inFlow (120 req/min).
 */
class InflowRateLimiter {
  private requests: number[] = [];
  private maxRequests = 120;
  private windowMs = 60000;

  async acquire(): Promise<void> {
    const now = Date.now();
    this.requests = this.requests.filter((t) => now - t < this.windowMs);

    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0]!;
      const waitMs = this.windowMs - (now - oldestRequest) + 10;
      logger.debug("inFlow: rate limit reached, waiting", { waitMs });
      await new Promise((resolve) => setTimeout(resolve, Math.max(0, waitMs)));
      return this.acquire();
    }

    this.requests.push(now);
  }
}

export class InflowApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public originalError?: Error,
  ) {
    super(message);
    this.name = "InflowApiError";
  }
}

/**
 * Exponential backoff retry policy.
 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 5): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err as Error;

      const isRetryable =
        err instanceof InflowApiError &&
        (err.statusCode === undefined || err.statusCode >= 500 || err.statusCode === 429);

      if (!isRetryable) {
        throw err;
      }

      const backoffMs = Math.min(2 ** attempt * 250, 30000);
      logger.debug("inFlow: retrying after backoff", {
        attempt,
        backoffMs,
        error: err instanceof Error ? err.message : String(err),
      });

      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }

  throw lastError || new Error("Max retries exceeded");
}

export class InflowApiClient {
  private baseUrl = "https://cloudapi.inflowinventory.com";
  private credentials: InflowCredentials;
  private rateLimiter = new InflowRateLimiter();

  constructor(credentials: InflowCredentials) {
    this.credentials = credentials;
  }

  private async request<T>(
    endpoint: string,
    params: Record<string, string | number | boolean> = {},
  ): Promise<T> {
    await this.rateLimiter.acquire();

    const url = new URL(`${this.baseUrl}/${this.credentials.companyId}${endpoint}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }

    return withRetry(async () => {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${this.credentials.apiToken}`,
        "Content-Type": "application/json",
      };

      const response = await fetch(url.toString(), {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        const text = await response.text();
        logger.error("inFlow API request failed", {
          endpoint,
          status: response.status,
          error: text,
        });
        throw new InflowApiError(`inFlow API error: ${response.status}`, response.status);
      }

      return response.json() as Promise<T>;
    });
  }

  /**
   * Fetch all products using cursor-based pagination.
   */
  async getAllProducts(): Promise<InflowProduct[]> {
    const results: InflowProduct[] = [];
    let cursor: string | undefined;
    const maxIterations = 1000;
    let iterations = 0;

    while (iterations < maxIterations) {
      const params: Record<string, string> = {};
      if (cursor) {
        params.cursor = cursor;
      }

      const response = await this.request<InflowCursoredResponse<InflowProduct>>(
        "/products",
        params,
      );

      results.push(...response.data);

      if (!response.hasMore || !response.cursor) {
        break;
      }

      cursor = response.cursor;
      iterations++;
    }

    return results;
  }

  /**
   * Fetch all vendors.
   */
  async getAllVendors(): Promise<InflowVendor[]> {
    const results: InflowVendor[] = [];
    let cursor: string | undefined;
    const maxIterations = 1000;
    let iterations = 0;

    while (iterations < maxIterations) {
      const params: Record<string, string> = {};
      if (cursor) {
        params.cursor = cursor;
      }

      const response = await this.request<InflowCursoredResponse<InflowVendor>>("/vendors", params);

      results.push(...response.data);

      if (!response.hasMore || !response.cursor) {
        break;
      }

      cursor = response.cursor;
      iterations++;
    }

    return results;
  }

  /**
   * Fetch all locations.
   */
  async getAllLocations(): Promise<InflowLocation[]> {
    const results: InflowLocation[] = [];
    let cursor: string | undefined;
    const maxIterations = 1000;
    let iterations = 0;

    while (iterations < maxIterations) {
      const params: Record<string, string> = {};
      if (cursor) {
        params.cursor = cursor;
      }

      const response = await this.request<InflowCursoredResponse<InflowLocation>>(
        "/locations",
        params,
      );

      results.push(...response.data);

      if (!response.hasMore || !response.cursor) {
        break;
      }

      cursor = response.cursor;
      iterations++;
    }

    return results;
  }

  /**
   * Fetch all stock levels.
   */
  async getAllStockLevels(): Promise<InflowStockLevel[]> {
    const results: InflowStockLevel[] = [];
    let cursor: string | undefined;
    const maxIterations = 1000;
    let iterations = 0;

    while (iterations < maxIterations) {
      const params: Record<string, string> = {};
      if (cursor) {
        params.cursor = cursor;
      }

      const response = await this.request<InflowCursoredResponse<InflowStockLevel>>(
        "/stockLevels",
        params,
      );

      results.push(...response.data);

      if (!response.hasMore || !response.cursor) {
        break;
      }

      cursor = response.cursor;
      iterations++;
    }

    return results;
  }

  /**
   * Fetch all purchase orders, optionally filtered by date.
   */
  async getAllPurchaseOrders(modifiedSince?: Date): Promise<InflowPurchaseOrder[]> {
    const results: InflowPurchaseOrder[] = [];
    let cursor: string | undefined;
    const maxIterations = 1000;
    let iterations = 0;

    while (iterations < maxIterations) {
      const params: Record<string, string> = {};
      if (cursor) {
        params.cursor = cursor;
      }
      if (modifiedSince) {
        params.modifiedSince = modifiedSince.toISOString();
      }

      const response = await this.request<InflowCursoredResponse<InflowPurchaseOrder>>(
        "/purchaseOrders",
        params,
      );

      results.push(...response.data);

      if (!response.hasMore || !response.cursor) {
        break;
      }

      cursor = response.cursor;
      iterations++;
    }

    return results;
  }
}
