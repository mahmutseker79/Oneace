/**
 * Phase MIG-S5 — SOS Inventory REST API v2 client with OAuth 2.0.
 *
 * SOS Inventory API:
 * - Base: https://api.sosinventory.com/api/v2/
 * - Auth: OAuth 2.0 with access token + refresh token
 * - Token lifetime: 1 hour
 * - Rate limit: 60 requests/minute (sliding window)
 * - Paging: limit + offset query params
 */

import { logger } from "@/lib/logger";

export interface SOSCredentials {
  accessToken: string;
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  realmId: string; // SOS-specific tenant/realm ID
}

export interface SOSPagedResponse<T> {
  data: T[];
  pagination?: {
    limit: number;
    offset: number;
    total: number;
  };
}

export interface SOSItem {
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

export interface SOSVendor {
  id: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  notes?: string;
}

export interface SOSLocation {
  id: string;
  name: string;
  code?: string;
  address?: string;
  isDefault?: boolean;
}

export interface SOSInventoryLocation {
  itemId: string;
  locationId: string;
  quantity: number;
}

export interface SOSPurchaseOrder {
  id: string;
  poNumber: string;
  vendorId: string;
  status: string;
  orderDate?: string;
  expectedDate?: string;
  notes?: string;
  lines: SOSPurchaseOrderLine[];
}

export interface SOSPurchaseOrderLine {
  itemId: string;
  quantity: number;
  unitCost?: number;
}

/**
 * Sliding-window rate limiter for SOS (60 req/min).
 */
class SOSRateLimiter {
  private requests: number[] = [];
  private maxRequests = 60;
  private windowMs = 60000; // 1 minute

  async acquire(): Promise<void> {
    const now = Date.now();
    this.requests = this.requests.filter((t) => now - t < this.windowMs);

    if (this.requests.length >= this.maxRequests) {
      // Length check above guarantees requests[0] exists; the `!` is
      // necessary because `noUncheckedIndexedAccess` doesn't narrow off a
      // preceding length comparison.
      const oldestRequest = this.requests[0]!;
      const waitMs = this.windowMs - (now - oldestRequest) + 10;
      logger.debug("SOS: rate limit reached, waiting", { waitMs });
      await new Promise((resolve) => setTimeout(resolve, Math.max(0, waitMs)));
      return this.acquire();
    }

    this.requests.push(now);
  }
}

export class SOSApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public originalError?: Error,
  ) {
    super(message);
    this.name = "SOSApiError";
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
        err instanceof SOSApiError &&
        (err.statusCode === undefined ||
          err.statusCode >= 500 ||
          err.statusCode === 429 ||
          err.statusCode === 401); // 401 triggers refresh

      if (!isRetryable) {
        throw err;
      }

      const backoffMs = Math.min(2 ** attempt * 250, 30000);
      logger.debug("SOS: retrying after backoff", {
        attempt,
        backoffMs,
        error: err instanceof Error ? err.message : String(err),
      });

      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }

  throw lastError || new Error("Max retries exceeded");
}

export class SOSApiClient {
  private baseUrl = "https://api.sosinventory.com/api/v2";
  private credentials: SOSCredentials;
  private rateLimiter = new SOSRateLimiter();

  constructor(credentials: SOSCredentials) {
    this.credentials = credentials;
  }

  /**
   * Refresh the access token if expired.
   */
  private async refreshAccessToken(): Promise<void> {
    try {
      const response = await fetch("https://api.sosinventory.com/oauth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          grant_type: "refresh_token",
          refresh_token: this.credentials.refreshToken,
          client_id: this.credentials.clientId,
          client_secret: this.credentials.clientSecret,
        }),
      });

      if (!response.ok) {
        throw new SOSApiError(`Token refresh failed: ${response.status}`, response.status);
      }

      const data = (await response.json()) as any;
      this.credentials.accessToken = data.access_token;

      if (data.refresh_token) {
        this.credentials.refreshToken = data.refresh_token;
      }

      logger.debug("SOS: token refreshed");
    } catch (err) {
      logger.error("SOS: token refresh failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  private async request<T>(
    endpoint: string,
    params: Record<string, string | number | boolean> = {},
  ): Promise<T> {
    await this.rateLimiter.acquire();

    const url = new URL(`${this.baseUrl}/${this.credentials.realmId}${endpoint}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }

    return withRetry(async () => {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${this.credentials.accessToken}`,
        "Content-Type": "application/json",
      };

      const response = await fetch(url.toString(), {
        method: "GET",
        headers,
      });

      // Auto-refresh on 401 and retry
      if (response.status === 401) {
        await this.refreshAccessToken();
        // Retry after refresh
        const retryHeaders: Record<string, string> = {
          Authorization: `Bearer ${this.credentials.accessToken}`,
          "Content-Type": "application/json",
        };

        const retryResponse = await fetch(url.toString(), {
          method: "GET",
          headers: retryHeaders,
        });

        if (!retryResponse.ok) {
          throw new SOSApiError(`SOS API error: ${retryResponse.status}`, retryResponse.status);
        }

        return retryResponse.json() as Promise<T>;
      }

      if (!response.ok) {
        const text = await response.text();
        logger.error("SOS API request failed", {
          endpoint,
          status: response.status,
          error: text,
        });
        throw new SOSApiError(`SOS API error: ${response.status}`, response.status);
      }

      return response.json() as Promise<T>;
    });
  }

  /**
   * Fetch all items with paging.
   */
  async getAllItems(): Promise<SOSItem[]> {
    const results: SOSItem[] = [];
    let offset = 0;
    const limit = 1000;
    const maxPages = 1000;
    let page = 0;

    while (page < maxPages) {
      const response = await this.request<SOSPagedResponse<SOSItem>>("/item", { limit, offset });

      results.push(...response.data);

      if (response.data.length < limit) {
        break;
      }

      offset += limit;
      page++;
    }

    return results;
  }

  /**
   * Fetch all vendors.
   */
  async getAllVendors(): Promise<SOSVendor[]> {
    const results: SOSVendor[] = [];
    let offset = 0;
    const limit = 1000;
    const maxPages = 1000;
    let page = 0;

    while (page < maxPages) {
      const response = await this.request<SOSPagedResponse<SOSVendor>>("/vendor", {
        limit,
        offset,
      });

      results.push(...response.data);

      if (response.data.length < limit) {
        break;
      }

      offset += limit;
      page++;
    }

    return results;
  }

  /**
   * Fetch all locations.
   */
  async getAllLocations(): Promise<SOSLocation[]> {
    const results: SOSLocation[] = [];
    let offset = 0;
    const limit = 1000;
    const maxPages = 1000;
    let page = 0;

    while (page < maxPages) {
      const response = await this.request<SOSPagedResponse<SOSLocation>>("/location", {
        limit,
        offset,
      });

      results.push(...response.data);

      if (response.data.length < limit) {
        break;
      }

      offset += limit;
      page++;
    }

    return results;
  }

  /**
   * Fetch all inventory locations (stock by item + location).
   */
  async getAllInventoryLocations(): Promise<SOSInventoryLocation[]> {
    const results: SOSInventoryLocation[] = [];
    let offset = 0;
    const limit = 1000;
    const maxPages = 1000;
    let page = 0;

    while (page < maxPages) {
      const response = await this.request<SOSPagedResponse<SOSInventoryLocation>>(
        "/inventorylocation",
        { limit, offset },
      );

      results.push(...response.data);

      if (response.data.length < limit) {
        break;
      }

      offset += limit;
      page++;
    }

    return results;
  }

  /**
   * Fetch all purchase orders, optionally filtered by date.
   */
  async getAllPurchaseOrders(modifiedSince?: Date): Promise<SOSPurchaseOrder[]> {
    const results: SOSPurchaseOrder[] = [];
    let offset = 0;
    const limit = 1000;
    const maxPages = 1000;
    let page = 0;

    const params: Record<string, string | number> = { limit };

    if (modifiedSince) {
      params.modifiedSince = modifiedSince.toISOString();
    }

    while (page < maxPages) {
      params.offset = offset;
      const response = await this.request<SOSPagedResponse<SOSPurchaseOrder>>(
        "/purchaseorder",
        params,
      );

      results.push(...response.data);

      if (response.data.length < limit) {
        break;
      }

      offset += limit;
      page++;
    }

    return results;
  }
}
