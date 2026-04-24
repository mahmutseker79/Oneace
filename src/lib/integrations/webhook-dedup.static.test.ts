// src/lib/integrations/webhook-dedup.static.test.ts
//
// Pinned static-analysis test for P1-02 (GOD MODE roadmap 2026-04-23).
//
// Invariants
// ----------
//   1. `prisma/schema.prisma` declares a `WebhookDeliveryEvent`
//      model with a (provider, externalId) unique index.
//   2. The 20260426 migration exists and creates the table +
//      unique index with idempotent DDL (CREATE TABLE IF NOT
//      EXISTS, CREATE UNIQUE INDEX IF NOT EXISTS).
//   3. The QuickBooks webhook route calls
//      `db.webhookDeliveryEvent.create` BEFORE parsing the body
//      (so a malformed retry still dedupes), and intercepts P2002
//      to return the deduped ack.

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function findRepoRoot(): string {
  let dir = path.resolve(__dirname);
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, "package.json"))) return dir;
    dir = path.dirname(dir);
  }
  throw new Error("repo root not found");
}

function extractModelBody(src: string, name: string): string | null {
  const header = new RegExp(`^model\\s+${name}\\s*\\{`, "m");
  const match = header.exec(src);
  if (!match) return null;
  const end = src.indexOf("\n}\n", match.index);
  if (end === -1) return null;
  return src.slice(match.index, end + 3);
}

describe("WebhookDeliveryEvent schema — P1-02", () => {
  const root = findRepoRoot();
  const schema = fs.readFileSync(path.join(root, "prisma", "schema.prisma"), "utf8");
  const body = extractModelBody(schema, "WebhookDeliveryEvent") ?? "";

  it("model exists", () => {
    expect(body.length).toBeGreaterThan(0);
  });

  it("declares provider + externalId as non-null String fields", () => {
    expect(/provider\s+String\b(?!\?)/.test(body)).toBe(true);
    expect(/externalId\s+String\b(?!\?)/.test(body)).toBe(true);
  });

  it("organizationId is nullable (unrouted deliveries still dedup)", () => {
    expect(/organizationId\s+String\?/.test(body)).toBe(true);
  });

  it("primary dedup unique index on (provider, externalId)", () => {
    expect(/@@unique\(\[provider,\s*externalId\]\)/.test(body)).toBe(true);
  });

  it("Organization back-ref is wired", () => {
    const orgBody = extractModelBody(schema, "Organization") ?? "";
    expect(/webhookDeliveryEvents\s+WebhookDeliveryEvent\[\]/.test(orgBody)).toBe(true);
  });
});

describe("Migration — 20260426_webhook_delivery_event", () => {
  const root = findRepoRoot();
  const migDir = path.join(root, "prisma", "migrations", "20260426000000_webhook_delivery_event");

  it("migration dir + sql exist", () => {
    expect(fs.existsSync(migDir)).toBe(true);
    expect(fs.existsSync(path.join(migDir, "migration.sql"))).toBe(true);
  });

  it("CREATE TABLE IF NOT EXISTS for WebhookDeliveryEvent", () => {
    const sql = fs.readFileSync(path.join(migDir, "migration.sql"), "utf8");
    expect(/CREATE TABLE IF NOT EXISTS\s+"WebhookDeliveryEvent"/.test(sql)).toBe(true);
  });

  it("Unique index on (provider, externalId) with IF NOT EXISTS", () => {
    const sql = fs.readFileSync(path.join(migDir, "migration.sql"), "utf8");
    expect(
      /CREATE UNIQUE INDEX IF NOT EXISTS[\s\S]*?"provider"[\s\S]*?"externalId"/.test(sql),
    ).toBe(true);
  });

  it("organizationId FK is guarded for idempotent re-run", () => {
    const sql = fs.readFileSync(path.join(migDir, "migration.sql"), "utf8");
    expect(
      /DO\s*\$\$[\s\S]*?"WebhookDeliveryEvent_organizationId_fkey"[\s\S]*?END\s*\$\$/.test(sql),
    ).toBe(true);
  });
});

describe("QuickBooks webhook route — P1-02 wiring", () => {
  const root = findRepoRoot();
  const routePath = path.join(
    root,
    "src",
    "app",
    "api",
    "integrations",
    "quickbooks",
    "webhooks",
    "route.ts",
  );
  const src = fs.readFileSync(routePath, "utf8");

  it("imports createHash from node:crypto", () => {
    expect(/createHash[,\s\S]*?from\s+["']node:crypto["']/.test(src)).toBe(true);
  });

  it("calls db.webhookDeliveryEvent.create", () => {
    expect(/\bdb\.webhookDeliveryEvent\.create\s*\(/.test(src)).toBe(true);
  });

  it("dedup write uses provider='quickbooks'", () => {
    expect(/provider:\s*["']quickbooks["']/.test(src)).toBe(true);
  });

  it("body hash is sha256 of the raw request body", () => {
    expect(/createHash\s*\(\s*["']sha256["']\s*\)\.update\(body/.test(src)).toBe(true);
  });

  it("dedup runs BEFORE payload parsing", () => {
    const dedupPos = src.search(/\bdb\.webhookDeliveryEvent\.create\s*\(/);
    const parsePos = src.search(/JSON\.parse\(body\)\s+as\s+QBOWebhookPayload/);
    expect(dedupPos).toBeGreaterThan(0);
    expect(parsePos).toBeGreaterThan(0);
    expect(
      dedupPos,
      "dedup insert must land before JSON.parse so malformed retries still dedupe",
    ).toBeLessThan(parsePos);
  });

  it("P2002 catch returns deduped ack (200)", () => {
    expect(/code\s*===\s*["']P2002["']/.test(src)).toBe(true);
    expect(/deduped:\s*true/.test(src)).toBe(true);
  });
});
