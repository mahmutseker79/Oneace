/**
 * Phase E: Abstract integration client base class.
 *
 * Provides common patterns for all integration providers:
 * - OAuth 2.0 authorization flow
 * - Token refresh and credential storage
 * - Rate limiting with exponential backoff
 * - Error handling and logging
 * - Request/response tracing
 *
 * Subclasses (QBO, Shopify, etc.) override `apiCall` and sync-specific logic.
 */

import { logger } from "@/lib/logger";

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authorizationUrl: string;
  tokenUrl: string;
  revokeUrl?: string;
}

export interface OAuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scope?: string;
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  backoffMultiplier?: number;
  maxBackoffMs?: number;
}

export interface ApiCallOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string>;
  body?: unknown;
  params?: Record<string, string | number | boolean>;
  timeout?: number;
  retries?: number;
}

export interface ApiResponse<T = unknown> {
  status: number;
  data: T;
  headers: Record<string, string>;
}

export interface IntegrationError extends Error {
  code: string;
  statusCode?: number;
  retryable: boolean;
  originalError?: Error;
}

/**
 * Abstract base class for integration providers.
 * Subclasses must implement `apiCall` and any provider-specific logic.
 */
export abstract class IntegrationClient {
  protected oauthConfig: OAuthConfig;
  protected credentials: OAuthToken;
  protected rateLimitConfig: RateLimitConfig;
  protected requestLog: Map<string, number> = new Map();
  protected baseUrl: string = "";

  constructor(
    oauthConfig: OAuthConfig,
    credentials: OAuthToken,
    rateLimitConfig: RateLimitConfig = {
      maxRequests: 100,
      windowMs: 60000,
      backoffMultiplier: 2,
      maxBackoffMs: 32000,
    },
  ) {
    this.oauthConfig = oauthConfig;
    this.credentials = credentials;
    this.rateLimitConfig = rateLimitConfig;
  }

  /**
   * Get the current access token, refreshing if necessary.
   */
  async getAccessToken(): Promise<string> {
    // Check if token is expired or expiring soon (5 min buffer)
    const now = Date.now();
    const expiresIn = this.credentials.expiresAt - now;

    if (expiresIn < 5 * 60 * 1000 && this.credentials.refreshToken) {
      await this.refreshToken();
    }

    return this.credentials.accessToken;
  }

  /**
   * Refresh the OAuth token.
   */
  protected async refreshToken(): Promise<void> {
    if (!this.credentials.refreshToken) {
      throw this.createError(
        "REFRESH_FAILED",
        "No refresh token available",
        false,
      );
    }

    try {
      const response = await fetch(this.oauthConfig.tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: this.credentials.refreshToken,
          client_id: this.oauthConfig.clientId,
          client_secret: this.oauthConfig.clientSecret,
        }),
      });

      if (!response.ok) {
        throw this.createError(
          "REFRESH_FAILED",
          `Token refresh failed: ${response.statusText}`,
          false,
        );
      }

      const data = (await response.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_in: number;
        scope?: string;
      };

      this.credentials = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || this.credentials.refreshToken,
        expiresAt: Date.now() + data.expires_in * 1000,
        scope: data.scope,
      };

      logger.info("Integration token refreshed", {
        provider: this.constructor.name,
      });
    } catch (error) {
      logger.error("Token refresh error", {
        provider: this.constructor.name,
        error,
      });
      throw error;
    }
  }

  /**
   * Check rate limit and apply backoff if needed.
   */
  protected async checkRateLimit(): Promise<void> {
    const now = Date.now();
    const windowStart = now - this.rateLimitConfig.windowMs;

    // Clean old requests outside the window
    for (const [key, timestamp] of this.requestLog.entries()) {
      if (timestamp < windowStart) {
        this.requestLog.delete(key);
      }
    }

    if (this.requestLog.size >= this.rateLimitConfig.maxRequests) {
      const oldestTimestamp = Math.min(...this.requestLog.values());
      const waitTime = oldestTimestamp + this.rateLimitConfig.windowMs - now;

      if (waitTime > 0) {
        logger.warn("Rate limit approached, backing off", {
          provider: this.constructor.name,
          waitMs: waitTime,
        });
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    // Record this request
    const requestId = `${now}-${Math.random()}`;
    this.requestLog.set(requestId, now);

    // Clean up old entry if map grew too large
    if (this.requestLog.size > this.rateLimitConfig.maxRequests * 2) {
      const firstKey = this.requestLog.keys().next().value;
      if (firstKey) {
        this.requestLog.delete(firstKey);
      }
    }
  }

  /**
   * Build request headers with authorization.
   */
  protected async getRequestHeaders(
    customHeaders?: Record<string, string>,
  ): Promise<Record<string, string>> {
    const accessToken = await this.getAccessToken();

    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...customHeaders,
    };
  }

  /**
   * Make an API call with error handling, rate limiting, and retries.
   * Subclasses can override for provider-specific behavior.
   */
  async apiCall<T = unknown>(
    endpoint: string,
    options: ApiCallOptions = {},
  ): Promise<ApiResponse<T>> {
    const {
      method = "GET",
      headers = {},
      body,
      params,
      timeout = 30000,
      retries = 3,
    } = options;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        await this.checkRateLimit();

        const requestHeaders = await this.getRequestHeaders(headers);
        const url = this.buildUrl(endpoint, params);

        const controller = new AbortController();
        const timeoutHandle = setTimeout(() => controller.abort(), timeout);

        const fetchOptions: RequestInit = {
          method,
          headers: requestHeaders,
          signal: controller.signal,
        };

        if (body) {
          fetchOptions.body = JSON.stringify(body);
        }

        const response = await fetch(url, fetchOptions).finally(() => {
          clearTimeout(timeoutHandle);
        });

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            // Unauthorized - try to refresh token once
            if (attempt === 0 && this.credentials.refreshToken) {
              await this.refreshToken();
              continue;
            }
          }

          const isRetryable = response.status >= 500 || response.status === 429;

          throw this.createError(
            `HTTP_${response.status}`,
            `API call failed: ${response.statusText}`,
            isRetryable,
            response.status,
          );
        }

        const data = (await response.json()) as T;

        return {
          status: response.status,
          data,
          headers: Object.fromEntries(response.headers.entries()),
        };
      } catch (error) {
        lastError = error as Error;

        if (!(error instanceof Error)) {
          throw error;
        }

        const isIntegrationError = "retryable" in error;
        const isRetryable = isIntegrationError
          ? (error as IntegrationError).retryable
          : error instanceof TypeError;

        if (!isRetryable || attempt === retries) {
          if (isIntegrationError) {
            throw error;
          }
          throw this.createError(
            "API_CALL_FAILED",
            error.message,
            false,
            undefined,
            error,
          );
        }

        // Exponential backoff
        const backoffMs = Math.min(
          Math.pow(
            this.rateLimitConfig.backoffMultiplier || 2,
            attempt,
          ) * 1000,
          this.rateLimitConfig.maxBackoffMs || 32000,
        );

        logger.warn("API call failed, retrying", {
          provider: this.constructor.name,
          endpoint,
          attempt,
          backoffMs,
          error: error.message,
        });

        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }

    throw lastError || this.createError(
      "API_CALL_FAILED",
      "Max retries exceeded",
      false,
    );
  }

  /**
   * Build a full URL with query parameters.
   */
  protected buildUrl(
    endpoint: string,
    params?: Record<string, string | number | boolean>,
  ): string {
    const url = new URL(endpoint.startsWith("http")
      ? endpoint
      : `${this.baseUrl}${endpoint}`);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }

    return url.toString();
  }

  /**
   * Get the OAuth authorization URL to redirect the user to.
   */
  getAuthorizationUrl(state: string, scope: string[]): string {
    const url = new URL(this.oauthConfig.authorizationUrl);
    url.searchParams.append("client_id", this.oauthConfig.clientId);
    url.searchParams.append("redirect_uri", this.oauthConfig.redirectUri);
    url.searchParams.append("response_type", "code");
    url.searchParams.append("scope", scope.join(" "));
    url.searchParams.append("state", state);

    return url.toString();
  }

  /**
   * Exchange an authorization code for tokens.
   */
  async exchangeCodeForToken(code: string): Promise<OAuthToken> {
    try {
      const response = await fetch(this.oauthConfig.tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: this.oauthConfig.redirectUri,
          client_id: this.oauthConfig.clientId,
          client_secret: this.oauthConfig.clientSecret,
        }),
      });

      if (!response.ok) {
        throw this.createError(
          "TOKEN_EXCHANGE_FAILED",
          `Failed to exchange code: ${response.statusText}`,
          false,
        );
      }

      const data = (await response.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_in: number;
        scope?: string;
      };

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + data.expires_in * 1000,
        scope: data.scope,
      };
    } catch (error) {
      if (error instanceof Error && "code" in error) {
        throw error;
      }
      throw this.createError(
        "TOKEN_EXCHANGE_FAILED",
        error instanceof Error ? error.message : "Unknown error",
        false,
        undefined,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Revoke the current token.
   */
  async revokeToken(): Promise<void> {
    if (!this.oauthConfig.revokeUrl) {
      logger.warn("No revoke URL configured", {
        provider: this.constructor.name,
      });
      return;
    }

    try {
      await fetch(this.oauthConfig.revokeUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          token: this.credentials.accessToken,
          client_id: this.oauthConfig.clientId,
          client_secret: this.oauthConfig.clientSecret,
        }),
      });

      logger.info("Integration token revoked", {
        provider: this.constructor.name,
      });
    } catch (error) {
      logger.error("Token revocation error", {
        provider: this.constructor.name,
        error,
      });
      // Don't throw - revocation is best-effort
    }
  }

  /**
   * Helper to create typed integration errors.
   */
  protected createError(
    code: string,
    message: string,
    retryable: boolean,
    statusCode?: number,
    originalError?: Error,
  ): IntegrationError {
    const error = new Error(message) as IntegrationError;
    error.code = code;
    error.statusCode = statusCode;
    error.retryable = retryable;
    error.originalError = originalError;
    error.name = "IntegrationError";
    return error;
  }

  /**
   * Get the current credentials (for storage in Integration.credentials).
   */
  getCredentials(): OAuthToken {
    return this.credentials;
  }

  /**
   * Update credentials from stored data.
   */
  setCredentials(credentials: OAuthToken): void {
    this.credentials = credentials;
  }
}

export default IntegrationClient;
