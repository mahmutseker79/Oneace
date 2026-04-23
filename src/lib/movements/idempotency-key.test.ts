// src/lib/movements/idempotency-key.test.ts
//
// Unit tests for the P0-03 idempotency-key helpers.

import { describe, expect, it } from "vitest";

import {
  LEGACY_KEY_PREFIX,
  WEBHOOK_KEY_PREFIX,
  deriveLegacyBackfillKey,
  deriveWebhookIdempotencyKey,
  generateMovementIdempotencyKey,
  isReservedLegacyKey,
} from "./idempotency-key";

describe("generateMovementIdempotencyKey", () => {
  it("returns a non-empty string", () => {
    const k = generateMovementIdempotencyKey();
    expect(typeof k).toBe("string");
    expect(k.length).toBeGreaterThan(0);
  });

  it("returns distinct values across calls", () => {
    const keys = new Set<string>();
    for (let i = 0; i < 64; i += 1) keys.add(generateMovementIdempotencyKey());
    expect(keys.size).toBe(64);
  });

  it("stays under the 128-char schema ceiling", () => {
    for (let i = 0; i < 32; i += 1) {
      expect(generateMovementIdempotencyKey().length).toBeLessThanOrEqual(128);
    }
  });
});

describe("deriveWebhookIdempotencyKey", () => {
  it("is deterministic for the same (provider, deliveryId)", () => {
    const a = deriveWebhookIdempotencyKey("shopify", "abc123");
    const b = deriveWebhookIdempotencyKey("shopify", "abc123");
    expect(a).toBe(b);
  });

  it("differs across providers even with the same deliveryId", () => {
    expect(deriveWebhookIdempotencyKey("shopify", "abc")).not.toBe(
      deriveWebhookIdempotencyKey("quickbooks", "abc"),
    );
  });

  it("prefixes with the webhook-namespace marker", () => {
    const k = deriveWebhookIdempotencyKey("shopify", "abc");
    expect(k.startsWith(WEBHOOK_KEY_PREFIX)).toBe(true);
  });

  it("rejects empty provider", () => {
    expect(() => deriveWebhookIdempotencyKey("", "abc")).toThrow(/invalid provider/);
  });

  it("rejects provider with uppercase characters", () => {
    expect(() => deriveWebhookIdempotencyKey("Shopify", "abc")).toThrow(/invalid provider/);
  });

  it("rejects provider with spaces or other non-kebab characters", () => {
    expect(() => deriveWebhookIdempotencyKey("quick books", "abc")).toThrow(
      /invalid provider/,
    );
  });

  it("rejects empty deliveryId", () => {
    expect(() => deriveWebhookIdempotencyKey("shopify", "")).toThrow(/deliveryId required/);
  });

  it("rejects whitespace-only deliveryId", () => {
    expect(() => deriveWebhookIdempotencyKey("shopify", "   ")).toThrow(/deliveryId required/);
  });

  it("trims whitespace around deliveryId", () => {
    expect(deriveWebhookIdempotencyKey("shopify", "  abc  ")).toBe(
      deriveWebhookIdempotencyKey("shopify", "abc"),
    );
  });

  it("truncates excessively long deliveryId to stay under 128 chars", () => {
    const huge = "x".repeat(500);
    const k = deriveWebhookIdempotencyKey("shopify", huge);
    expect(k.length).toBeLessThanOrEqual(128);
    expect(k.startsWith("wh:shopify:")).toBe(true);
  });
});

describe("deriveLegacyBackfillKey", () => {
  it("prefixes with the LEGACY marker", () => {
    const k = deriveLegacyBackfillKey("mvmt_abc");
    expect(k.startsWith(LEGACY_KEY_PREFIX)).toBe(true);
    expect(k).toBe("LEGACY:mvmt_abc");
  });

  it("rejects empty movementId", () => {
    expect(() => deriveLegacyBackfillKey("")).toThrow(/movementId required/);
  });
});

describe("isReservedLegacyKey", () => {
  it("flags LEGACY:-prefixed values", () => {
    expect(isReservedLegacyKey("LEGACY:anything")).toBe(true);
  });
  it("passes through non-reserved values", () => {
    expect(isReservedLegacyKey("some-uuid-here")).toBe(false);
    expect(isReservedLegacyKey("wh:shopify:abc")).toBe(false);
  });
  it("handles null / undefined safely", () => {
    expect(isReservedLegacyKey(null)).toBe(false);
    expect(isReservedLegacyKey(undefined)).toBe(false);
  });
});
