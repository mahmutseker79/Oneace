// Audit v1.1 §5.28 — Resend (Svix) webhook verification.
//
// Five moving parts must stay in sync:
//
//   1. Prisma `User.emailStatus` + `EmailStatusUpdatedAt` + the
//      `EmailStatus` enum — if these drift, the route can't write
//      deliverability state.
//   2. Migration SQL — mirrors the Prisma model 1:1 for prod.
//   3. `resend-webhook.ts` verifier — timing-safe HMAC, 5-min
//      replay window, multi-version tolerance.
//   4. `env.ts` — `RESEND_WEBHOOK_SECRET` must be optional (env
//      schema still accepts absent; the route 503s).
//   5. Route + guard wiring — pinned by the route-shape test.
//
// This file tests (1)–(3) with source reads + runtime unit tests
// on the verifier's pure logic.

import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  RESEND_STATE_CHANGING_EVENTS,
  SVIX_TOLERANCE_SECONDS,
  resendEventToStatus,
  verifyResendWebhook,
} from "./resend-webhook";

// ─── Static source reads ──────────────────────────────────────────────

const REPO_ROOT = resolve(__dirname, "..", "..", "..");
const SCHEMA = readFileSync(
  resolve(REPO_ROOT, "prisma", "schema.prisma"),
  "utf8",
);
const MIGRATION = readFileSync(
  resolve(
    REPO_ROOT,
    "prisma",
    "migrations",
    "20260418110000_email_status_webhook",
    "migration.sql",
  ),
  "utf8",
);
const ENV = readFileSync(resolve(REPO_ROOT, "src", "lib", "env.ts"), "utf8");

function sliceEnum(name: string): string {
  const marker = `enum ${name} {`;
  const start = SCHEMA.indexOf(marker);
  expect(start, `enum ${name} must exist in schema.prisma`).toBeGreaterThan(-1);
  const bodyStart = start + marker.length;
  const end = SCHEMA.indexOf("\n}", bodyStart);
  return SCHEMA.slice(start, end + 2);
}

function sliceModel(name: string): string {
  const marker = `model ${name} {`;
  const start = SCHEMA.indexOf(marker);
  expect(start, `model ${name} must exist`).toBeGreaterThan(-1);
  const bodyStart = start + marker.length;
  const end = SCHEMA.indexOf("\n}", bodyStart);
  return SCHEMA.slice(start, end + 2);
}

// ─── Prisma schema ────────────────────────────────────────────────────

describe("P2-6 §5.28 — Prisma schema for email deliverability", () => {
  it("has `EmailStatus` enum with the four required values", () => {
    const body = sliceEnum("EmailStatus");
    for (const v of ["ACTIVE", "BOUNCED", "COMPLAINED", "UNSUBSCRIBED"]) {
      expect(body).toMatch(new RegExp(`\\b${v}\\b`));
    }
  });

  it("User has `emailStatus` + `emailStatusUpdatedAt` fields", () => {
    const user = sliceModel("User");
    // The default must be ACTIVE, otherwise every existing row
    // would need an explicit backfill and the migration would
    // fail on `ADD COLUMN NOT NULL` without a default.
    expect(user).toMatch(
      /emailStatus\s+EmailStatus\s+@default\(\s*ACTIVE\s*\)/,
    );
    // Nullable timestamp — null means "never changed from default".
    expect(user).toMatch(/emailStatusUpdatedAt\s+DateTime\?/);
  });

  it("User has an index on emailStatus (admin filter: bouncing users)", () => {
    const user = sliceModel("User");
    expect(user).toMatch(/@@index\(\s*\[\s*emailStatus\s*\]\s*\)/);
  });
});

// ─── Migration SQL mirrors the schema ─────────────────────────────────

describe("P2-6 §5.28 — migration SQL matches Prisma", () => {
  it("creates the EmailStatus enum idempotently", () => {
    // The DO block with `IF NOT EXISTS` is what makes reapplying
    // the migration safe — important because of FUSE re-plays.
    expect(MIGRATION).toMatch(
      /CREATE\s+TYPE\s+"EmailStatus"\s+AS\s+ENUM\s*\(\s*'ACTIVE',\s*'BOUNCED',\s*'COMPLAINED',\s*'UNSUBSCRIBED'\s*\)/i,
    );
    expect(MIGRATION).toMatch(
      /SELECT\s+1\s+FROM\s+pg_type\s+WHERE\s+typname\s*=\s*'EmailStatus'/i,
    );
  });

  it("adds emailStatus + emailStatusUpdatedAt columns with IF NOT EXISTS", () => {
    expect(MIGRATION).toMatch(
      /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+"emailStatus"\s+"EmailStatus"\s+NOT\s+NULL\s+DEFAULT\s+'ACTIVE'/i,
    );
    expect(MIGRATION).toMatch(
      /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+"emailStatusUpdatedAt"\s+TIMESTAMP/i,
    );
  });

  it("creates the emailStatus index if missing", () => {
    expect(MIGRATION).toMatch(
      /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+"User_emailStatus_idx"\s+ON\s+"User"\("emailStatus"\)/i,
    );
  });
});

// ─── env schema wires the secret as optional ──────────────────────────

describe("P2-6 §5.28 — env schema", () => {
  it("declares RESEND_WEBHOOK_SECRET as optional", () => {
    // The route 503s if the secret is absent, so the schema must
    // not make it required (otherwise local dev without email
    // plumbing couldn't even boot).
    expect(ENV).toMatch(
      /RESEND_WEBHOOK_SECRET:\s*z\.string\(\)\.min\(1\)\.optional\(\)/,
    );
  });
});

// ─── Pure-function verifier ───────────────────────────────────────────

const SECRET = "dGhpcy1pcy1hLXRlc3Qtc2VjcmV0LWZvci1zdml4"; // base64("this-is-a-test-secret-for-svix")

function sign(
  id: string,
  timestamp: string,
  body: string,
  secret: string,
): string {
  const key = Buffer.from(secret, "base64");
  const mac = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");
  return `v1,${mac}`;
}

describe("verifyResendWebhook — happy path", () => {
  it("accepts a well-signed delivery within the replay window", () => {
    const id = "msg_01abc";
    const now = new Date("2026-04-18T12:00:00Z");
    const ts = String(Math.floor(now.getTime() / 1000));
    const body = JSON.stringify({ type: "email.bounced" });
    const signature = sign(id, ts, body, SECRET);

    const result = verifyResendWebhook(
      { id, timestamp: ts, signature },
      body,
      SECRET,
      now,
    );
    expect(result.ok).toBe(true);
  });

  it("strips the `whsec_` dashboard prefix", () => {
    const id = "msg_02";
    const now = new Date("2026-04-18T12:00:00Z");
    const ts = String(Math.floor(now.getTime() / 1000));
    const body = "{}";
    const signature = sign(id, ts, body, SECRET);

    const result = verifyResendWebhook(
      { id, timestamp: ts, signature },
      body,
      `whsec_${SECRET}`,
      now,
    );
    expect(result.ok).toBe(true);
  });

  it("accepts when ANY v1 candidate in the space-separated list matches", () => {
    // Svix's header may list multiple versions at rotation time.
    // We want to accept as long as one matches.
    const id = "msg_03";
    const now = new Date("2026-04-18T12:00:00Z");
    const ts = String(Math.floor(now.getTime() / 1000));
    const body = "{}";
    const goodSignature = sign(id, ts, body, SECRET);
    const bogus = "v1,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
    const mixed = `${bogus} ${goodSignature}`;

    const result = verifyResendWebhook(
      { id, timestamp: ts, signature: mixed },
      body,
      SECRET,
      now,
    );
    expect(result.ok).toBe(true);
  });
});

describe("verifyResendWebhook — rejection modes", () => {
  const now = new Date("2026-04-18T12:00:00Z");
  const ts = String(Math.floor(now.getTime() / 1000));
  const id = "msg_reject";
  const body = "{}";
  const goodSig = sign(id, ts, body, SECRET);

  it("rejects missing svix-id", () => {
    const result = verifyResendWebhook(
      { id: null, timestamp: ts, signature: goodSig },
      body,
      SECRET,
      now,
    );
    expect(result).toEqual({ ok: false, reason: expect.any(String) });
    if (!result.ok) expect(result.reason).toMatch(/missing svix/i);
  });

  it("rejects missing svix-timestamp", () => {
    const result = verifyResendWebhook(
      { id, timestamp: null, signature: goodSig },
      body,
      SECRET,
      now,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects missing svix-signature", () => {
    const result = verifyResendWebhook(
      { id, timestamp: ts, signature: null },
      body,
      SECRET,
      now,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a non-integer timestamp", () => {
    const result = verifyResendWebhook(
      { id, timestamp: "not-a-number", signature: goodSig },
      body,
      SECRET,
      now,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/timestamp/i);
  });

  it("rejects a timestamp outside the ±5-minute window (stale)", () => {
    const stale = String(
      Math.floor(now.getTime() / 1000) - SVIX_TOLERANCE_SECONDS - 1,
    );
    const signature = sign(id, stale, body, SECRET);
    const result = verifyResendWebhook(
      { id, timestamp: stale, signature },
      body,
      SECRET,
      now,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/tolerance/);
  });

  it("rejects a timestamp outside the ±5-minute window (future)", () => {
    const future = String(
      Math.floor(now.getTime() / 1000) + SVIX_TOLERANCE_SECONDS + 1,
    );
    const signature = sign(id, future, body, SECRET);
    const result = verifyResendWebhook(
      { id, timestamp: future, signature },
      body,
      SECRET,
      now,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a tampered body (MAC no longer matches)", () => {
    const tampered = body + "!";
    const result = verifyResendWebhook(
      { id, timestamp: ts, signature: goodSig },
      tampered,
      SECRET,
      now,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/no matching v1 signature/);
  });

  it("rejects when only non-v1 versions are in the header", () => {
    const v2 = "v2,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
    const result = verifyResendWebhook(
      { id, timestamp: ts, signature: v2 },
      body,
      SECRET,
      now,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects an empty decoded secret", () => {
    // Empty-string base64 decodes to zero bytes → no useful MAC.
    const result = verifyResendWebhook(
      { id, timestamp: ts, signature: goodSig },
      body,
      "", // → empty keyBytes
      now,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/empty/i);
  });
});

// ─── Event → status mapping ───────────────────────────────────────────

describe("resendEventToStatus + RESEND_STATE_CHANGING_EVENTS", () => {
  it("covers exactly the three state-changing events", () => {
    // This list drives suppression. Adding an event here without
    // adding a User.emailStatus transition would cause a runtime
    // `never` error — the explicit union check is the pin.
    expect([...RESEND_STATE_CHANGING_EVENTS]).toEqual([
      "email.bounced",
      "email.complained",
      "email.unsubscribed",
    ]);
  });

  it("maps each event to the matching EmailStatus value", () => {
    expect(resendEventToStatus("email.bounced")).toBe("BOUNCED");
    expect(resendEventToStatus("email.complained")).toBe("COMPLAINED");
    expect(resendEventToStatus("email.unsubscribed")).toBe("UNSUBSCRIBED");
  });

  it("SVIX_TOLERANCE_SECONDS is exactly 5 minutes", () => {
    // If this constant drifts, replay-protection widens or narrows
    // silently. Pin it.
    expect(SVIX_TOLERANCE_SECONDS).toBe(300);
  });
});
