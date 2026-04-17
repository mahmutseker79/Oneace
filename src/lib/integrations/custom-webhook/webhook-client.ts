/**
 * Custom Webhook Integration Client
 *
 * NOT a provider client — it's a configurable webhook sender/receiver.
 * Handles:
 * - Outbound: send HTTP POST to configured URL on entity changes
 * - Inbound: parse incoming webhook payloads with configurable entity mapping
 * - HMAC-SHA256 signature generation and verification
 * - Retry with exponential backoff (3 retries max)
 * - Configurable payload templates (JSON path mapping)
 * - Event types: item.created, item.updated, item.deleted, order.created, order.updated, stock.changed, etc.
 *
 * This is a standalone class, not extending IntegrationClient.
 */

import crypto from "node:crypto";
import { logger } from "@/lib/logger";

export interface WebhookConfig {
  url: string;
  secret: string;
  events: string[];
  headers?: Record<string, string>;
  payloadTemplate?: Record<string, string>; // JSON path mapping
  active: boolean;
  retryAttempts?: number;
  retryDelayMs?: number;
}

export interface WebhookEvent {
  id: string;
  eventType: string;
  timestamp: string;
  entityType: string;
  entityId: string;
  action: "created" | "updated" | "deleted";
  data: Record<string, unknown>;
  organizationId: string;
}

export interface WebhookPayload {
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
  signature?: string;
}

export interface IncomingWebhook {
  signature: string;
  payload: Record<string, unknown>;
}

class WebhookClient {
  private config: WebhookConfig;
  private failureLog: Array<{
    eventId: string;
    error: string;
    timestamp: Date;
    attempts: number;
  }> = [];

  constructor(config: WebhookConfig) {
    this.config = config;
  }

  /**
   * Generate HMAC-SHA256 signature for payload.
   */
  generateSignature(payload: string): string {
    return crypto.createHmac("sha256", this.config.secret).update(payload).digest("hex");
  }

  /**
   * Verify incoming webhook signature.
   */
  verifySignature(payload: string, signature: string): boolean {
    const expectedSignature = this.generateSignature(payload);
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  }

  /**
   * Build webhook payload from entity data.
   */
  buildPayload(event: WebhookEvent): WebhookPayload {
    const payload: WebhookPayload = {
      event: event.eventType,
      timestamp: event.timestamp,
      data: {},
    };

    // Apply payload template if configured
    if (this.config.payloadTemplate) {
      Object.entries(this.config.payloadTemplate).forEach(([key, jsonPath]) => {
        const value = this.getValueByPath(event.data, jsonPath);
        if (value !== undefined) {
          payload.data[key] = value;
        }
      });
    } else {
      // Default: include all event data
      payload.data = { ...event.data };
    }

    // Generate signature
    const payloadString = JSON.stringify(payload);
    payload.signature = this.generateSignature(payloadString);

    return payload;
  }

  /**
   * Send webhook to configured URL with retry logic.
   */
  async send(event: WebhookEvent, retryAttempt = 0): Promise<boolean> {
    if (!this.config.active) {
      logger.info("Webhook is inactive, skipping send", { eventId: event.id });
      return false;
    }

    // Check if event type is subscribed
    if (!this.config.events.includes(event.eventType)) {
      logger.info("Event type not subscribed", {
        eventType: event.eventType,
        subscribedEvents: this.config.events,
      });
      return false;
    }

    try {
      const payload = this.buildPayload(event);
      const payloadString = JSON.stringify(payload);

      const response = await fetch(this.config.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": payload.signature || "",
          "X-Webhook-Event": event.eventType,
          "X-Webhook-Timestamp": event.timestamp,
          ...this.config.headers,
        },
        body: payloadString,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      logger.info("Webhook sent successfully", {
        eventId: event.id,
        eventType: event.eventType,
        url: this.config.url,
      });

      return true;
    } catch (error) {
      const maxRetries = this.config.retryAttempts || 3;
      const delayMs = this.config.retryDelayMs || 1000;

      if (retryAttempt < maxRetries) {
        const backoffDelay = delayMs * 2 ** retryAttempt;
        logger.warn("Webhook send failed, scheduling retry", {
          eventId: event.id,
          attempt: retryAttempt + 1,
          maxRetries,
          backoffDelayMs: backoffDelay,
          error,
        });

        // Schedule retry (in real implementation, would use a job queue)
        await new Promise((resolve) => setTimeout(resolve, backoffDelay));
        return this.send(event, retryAttempt + 1);
      }
      logger.error("Webhook send failed after max retries", {
        eventId: event.id,
        attempts: retryAttempt + 1,
        error,
      });

      // Log failure for manual review
      this.failureLog.push({
        eventId: event.id,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date(),
        attempts: retryAttempt + 1,
      });

      return false;
    }
  }

  /**
   * Process incoming webhook payload.
   */
  processIncomingWebhook(payload: Record<string, unknown>, signature: string): boolean {
    try {
      const payloadString = JSON.stringify(payload);

      // Verify signature
      if (!this.verifySignature(payloadString, signature)) {
        logger.error("Webhook signature verification failed", {
          url: this.config.url,
        });
        return false;
      }

      logger.info("Incoming webhook processed", {
        payload,
      });

      return true;
    } catch (error) {
      logger.error("Failed to process incoming webhook", {
        error,
      });
      return false;
    }
  }

  /**
   * Get value from nested object by JSON path (simplified).
   * Example: "data.customer.email" => event.data.customer.email
   */
  private getValueByPath(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split(".");
    let current: unknown = obj;

    for (const part of parts) {
      if (current && typeof current === "object") {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Get failure log.
   */
  getFailureLog(): Array<{
    eventId: string;
    error: string;
    timestamp: Date;
    attempts: number;
  }> {
    return [...this.failureLog];
  }

  /**
   * Clear failure log.
   */
  clearFailureLog(): void {
    this.failureLog = [];
    logger.info("Webhook failure log cleared");
  }

  /**
   * Update webhook configuration.
   */
  updateConfig(newConfig: Partial<WebhookConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig,
    };
    logger.info("Webhook configuration updated", {
      url: this.config.url,
      active: this.config.active,
      events: this.config.events,
    });
  }

  /**
   * Get current configuration.
   */
  getConfig(): WebhookConfig {
    return {
      ...this.config,
      secret: "***", // Don't expose secret
    };
  }
}

export default WebhookClient;
