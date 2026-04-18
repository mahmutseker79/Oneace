// P1-3 remediation test (audit v1.0 §5.7) — pins the Shopify webhook
// idempotency policy by reading the route source and verifying:
//
//   1. The handler reads `X-Shopify-Webhook-Id` (the dedup key).
//   2. The handler INSERTs into `ShopifyWebhookEvent` BEFORE routing
//      the topic — so a duplicate delivery short-circuits before
//      double-applying state.
//   3. Insertion failures are inspected: a P2002 unique-constraint
//      violation returns 200 + `deduped: true`; any other error
//      bubbles up.
//   4. HMAC verification still happens before the dedup check (never
//      let an unauthenticated caller probe the dedup table).
//
// We deliberately do not import the route module — Next.js server
// runtime imports (NextRequest, headers, db client) make that
// brittle in Vitest. Source-level pinning is enough to catch
// regressions in the policy without coupling to the runtime.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const ROUTE_PATH = resolve(__dirname, "route.ts");
const SOURCE = readFileSync(ROUTE_PATH, "utf8");

describe("P1-3 — Shopify webhook idempotency policy", () => {
  it("reads X-Shopify-Webhook-Id from request headers", () => {
    expect(SOURCE).toMatch(/request\.headers\.get\(\s*["']x-shopify-webhook-id["']\s*\)/);
  });

  it("HMAC verification happens before any DB access", () => {
    const hmacIdx = SOURCE.indexOf("timingSafeEqual");
    const insertIdx = SOURCE.indexOf("shopifyWebhookEvent.create");
    expect(hmacIdx).toBeGreaterThan(0);
    expect(insertIdx).toBeGreaterThan(hmacIdx);
  });

  it("inserts a ShopifyWebhookEvent row before routing the topic", () => {
    const insertIdx = SOURCE.indexOf("shopifyWebhookEvent.create");
    const routeIdx = SOURCE.indexOf("routeShopifyTopic(");
    expect(insertIdx).toBeGreaterThan(0);
    expect(routeIdx).toBeGreaterThan(insertIdx);
  });

  it("treats P2002 (unique violation) as a duplicate and returns 200 + deduped", () => {
    expect(SOURCE).toMatch(/code\s*===\s*["']P2002["']/);
    expect(SOURCE).toMatch(/deduped:\s*true/);
  });

  it("rethrows non-P2002 errors from the dedup insert", () => {
    // The catch block must do `if (isUniqueConstraintError(err)) ... else throw err;`
    // We pin `throw err` exists somewhere after the dedup insert.
    const insertIdx = SOURCE.indexOf("shopifyWebhookEvent.create");
    const throwIdx = SOURCE.indexOf("throw err", insertIdx);
    expect(throwIdx).toBeGreaterThan(insertIdx);
  });

  it("logs a warning if the X-Shopify-Webhook-Id header is missing (no dedup possible)", () => {
    // We don't crash in that case — older deliveries / forwarders may
    // strip the header — but we do log a warning so we can spot it.
    expect(SOURCE).toMatch(/missing X-Shopify-Webhook-Id/i);
  });

  it("uses the Shopify-supplied id (not a hash of the body) as the dedup key", () => {
    // A subtle regression would be keying on a content hash, which
    // would cause "same topic, slightly different payload" to be
    // re-processed when it shouldn't be. The id is what Shopify
    // promises stable across retries.
    expect(SOURCE).toMatch(/data:\s*\{\s*webhookId\b/);
  });
});

describe("P1-3 — schema pin", () => {
  it("ShopifyWebhookEvent model exists with @unique on webhookId", () => {
    const schema = readFileSync(
      resolve(__dirname, "../../../../../../prisma/schema.prisma"),
      "utf8",
    );
    expect(schema).toMatch(/model\s+ShopifyWebhookEvent\s*\{/);
    // Match the model block and confirm webhookId has @unique.
    const match = schema.match(/model\s+ShopifyWebhookEvent\s*\{[^}]+\}/);
    expect(match).not.toBeNull();
    expect(match?.[0]).toMatch(/webhookId\s+String\s+@unique/);
  });
});
