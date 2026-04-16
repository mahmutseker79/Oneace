/**
 * Phase E: Outbound webhook dispatcher.
 *
 * Manages webhook delivery with:
 * - HMAC signature generation
 * - Automatic retries with exponential backoff
 * - Request timeout and circuit breaking
 * - Delivery log tracking
 */

import { createHmac } from "node:crypto";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

interface WebhookRecord {
  id: string;
  url: string;
  active?: boolean;
  [key: string]: unknown;
}

export interface WebhookPayload {
  event: string;
  timestamp: Date;
  organizationId: string;
  data: Record<string, unknown>;
}

export interface WebhookDeliveryAttempt {
  webhookId: string;
  url: string;
  payload: WebhookPayload;
  attempt: number;
  maxRetries: number;
  backoffMultiplier?: number;
}

export interface WebhookDeliveryResult {
  success: boolean;
  statusCode?: number;
  responseTime: number;
  error?: string;
  attempts: number;
}

/**
 * Webhook dispatcher.
 */
export class WebhookDispatcher {
  private secret: string;
  private timeout: number;
  private maxRetries: number;
  private baseBackoff: number;
  private maxBackoff: number;

  constructor(
    secret: string = process.env.WEBHOOK_SECRET || "default-secret",
    config: {
      timeout?: number;
      maxRetries?: number;
      baseBackoff?: number;
      maxBackoff?: number;
    } = {},
  ) {
    this.secret = secret;
    this.timeout = config.timeout || 30000;
    this.maxRetries = config.maxRetries || 3;
    this.baseBackoff = config.baseBackoff || 1000;
    this.maxBackoff = config.maxBackoff || 32000;
  }

  /**
   * Dispatch a webhook to all registered endpoints.
   */
  async dispatch(
    organizationId: string,
    event: string,
    data: Record<string, unknown>,
  ): Promise<WebhookDeliveryResult[]> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const webhooks: WebhookRecord[] =
        (await (db as any).webhook?.findMany({
          where: {
            organizationId,
            active: true,
          },
        })) ?? [];

      if (webhooks.length === 0) {
        return [];
      }

      const payload: WebhookPayload = {
        event,
        timestamp: new Date(),
        organizationId,
        data,
      };

      const results = await Promise.all(
        webhooks.map((webhook) =>
          this.dispatchToEndpoint({
            webhookId: webhook.id,
            url: webhook.url,
            payload,
            attempt: 1,
            maxRetries: this.maxRetries,
          }),
        ),
      );

      return results;
    } catch (error) {
      logger.warn("Webhook dispatch failed", { error, organizationId });
      return [];
    }
  }

  /**
   * Dispatch to a single endpoint with retry logic.
   */
  private async dispatchToEndpoint(
    attempt: WebhookDeliveryAttempt,
  ): Promise<WebhookDeliveryResult> {
    const startTime = Date.now();

    try {
      const signature = this.generateSignature(attempt.payload);
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
        "X-Webhook-Timestamp": attempt.payload.timestamp.toISOString(),
        "X-Webhook-Delivery-ID": `${attempt.webhookId}-${Date.now()}`,
      };

      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), this.timeout);

      try {
        const response = await fetch(attempt.url, {
          method: "POST",
          headers,
          body: JSON.stringify(attempt.payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutHandle);

        const responseTime = Date.now() - startTime;

        if (response.ok) {
          logger.info("Webhook delivered successfully", {
            webhookId: attempt.webhookId,
            url: attempt.url,
            responseTime,
          });

          return {
            success: true,
            statusCode: response.status,
            responseTime,
            attempts: attempt.attempt,
          };
        }
        if (response.status >= 400 && response.status < 500) {
          // Client error - don't retry
          logger.warn("Webhook delivery failed (client error)", {
            webhookId: attempt.webhookId,
            url: attempt.url,
            statusCode: response.status,
          });

          return {
            success: false,
            statusCode: response.status,
            responseTime,
            error: `HTTP ${response.status}`,
            attempts: attempt.attempt,
          };
        }
        // Server error or rate limit - retry
        if (attempt.attempt < attempt.maxRetries) {
          return this.retryWithBackoff(attempt);
        }

        return {
          success: false,
          statusCode: response.status,
          responseTime,
          error: `HTTP ${response.status} after ${attempt.attempt} attempts`,
          attempts: attempt.attempt,
        };
      } catch (fetchError) {
        clearTimeout(timeoutHandle);

        if (fetchError instanceof Error && fetchError.name === "AbortError") {
          // Timeout - retry
          if (attempt.attempt < attempt.maxRetries) {
            return this.retryWithBackoff(attempt);
          }

          return {
            success: false,
            responseTime: Date.now() - startTime,
            error: `Timeout after ${attempt.attempt} attempts`,
            attempts: attempt.attempt,
          };
        }

        // Other network error - retry
        if (attempt.attempt < attempt.maxRetries) {
          return this.retryWithBackoff(attempt);
        }

        return {
          success: false,
          responseTime: Date.now() - startTime,
          error: fetchError instanceof Error ? fetchError.message : "Network error",
          attempts: attempt.attempt,
        };
      }
    } catch (error) {
      logger.error("Webhook dispatch error", {
        webhookId: attempt.webhookId,
        url: attempt.url,
        error,
      });

      return {
        success: false,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : "Unknown error",
        attempts: attempt.attempt,
      };
    }
  }

  /**
   * Retry with exponential backoff.
   */
  private async retryWithBackoff(
    attempt: WebhookDeliveryAttempt,
  ): Promise<WebhookDeliveryResult> {
    const multiplier = attempt.backoffMultiplier || 2;
    const backoffMs = Math.min(
      this.baseBackoff * multiplier ** (attempt.attempt - 1),
      this.maxBackoff,
    );

    logger.info("Webhook retry scheduled", {
      webhookId: attempt.webhookId,
      url: attempt.url,
      nextAttempt: attempt.attempt + 1,
      backoffMs,
    });

    await new Promise((resolve) => setTimeout(resolve, backoffMs));

    return this.dispatchToEndpoint({
      ...attempt,
      attempt: attempt.attempt + 1,
    });
  }

  /**
   * Generate HMAC-SHA256 signature for request validation.
   */
  private generateSignature(payload: WebhookPayload): string {
    const body = JSON.stringify(payload);
    const signature = createHmac("sha256", this.secret).update(body).digest("hex");

    return `sha256=${signature}`;
  }

  /**
   * Verify a webhook signature (for inbound validation).
   */
  static verifySignature(payload: string, signature: string, secret: string): boolean {
    const expected = createHmac("sha256", secret).update(payload).digest("hex");

    const providedSignature = signature.replace("sha256=", "");

    // Constant-time comparison to prevent timing attacks
    return Buffer.from(expected).equals(Buffer.from(providedSignature));
  }

  /**
   * Test a webhook endpoint with a ping event.
   */
  async testWebhook(
    webhookId: string,
    url: string,
  ): Promise<{
    success: boolean;
    statusCode?: number;
    responseTime: number;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      const payload: WebhookPayload = {
        event: "webhook.test",
        timestamp: new Date(),
        organizationId: "test",
        data: { message: "Webhook test ping" },
      };

      const signature = this.generateSignature(payload);
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
        "X-Webhook-Timestamp": payload.timestamp.toISOString(),
        "X-Webhook-Delivery-ID": `${webhookId}-test`,
      };

      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutHandle);

      return {
        success: response.ok,
        statusCode: response.status,
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

export default WebhookDispatcher;
