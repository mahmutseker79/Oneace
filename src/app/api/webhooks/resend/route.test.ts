// Audit v1.1 §5.28 — Resend webhook route source shape.
//
// The runtime verifier is exercised in resend-webhook.test.ts. Here
// we pin the *wiring* of the route itself: it must read the raw
// body, call the verifier, update User.emailStatus on valid state-
// changing events, and map error classes to the right HTTP codes.
// Drift in any of these invariants turns the endpoint into a silent
// no-op or — worse — an auth-bypass.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROUTE_SRC = readFileSync(resolve(__dirname, "route.ts"), "utf8");

describe("P2-6 §5.28 — Resend webhook route wiring", () => {
  it("is a POST handler (HEAD too, but POST is the real endpoint)", () => {
    expect(ROUTE_SRC).toMatch(/export\s+async\s+function\s+POST\s*\(/);
    expect(ROUTE_SRC).toMatch(/export\s+async\s+function\s+HEAD\s*\(/);
  });

  it("reads the RAW body via request.text() — never request.json()", () => {
    // JSON.parse before verification would re-serialise and the
    // MAC would never match. The verifier's doc-comment explicitly
    // warns against this; pin it so regressions fail loudly.
    expect(ROUTE_SRC).toMatch(/request\.text\(\)/);
    // Strip line and block comments before the "must not" check —
    // the module-level doc comment intentionally mentions
    // `request.json()` as the anti-pattern we reject.
    const codeOnly = ROUTE_SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(
      /^\s*\*.*$/gm,
      "",
    );
    expect(codeOnly).not.toMatch(/request\.json\(\)/);
  });

  it("reads all three svix headers", () => {
    expect(ROUTE_SRC).toMatch(/headers\.get\(["']svix-id["']\)/);
    expect(ROUTE_SRC).toMatch(/headers\.get\(["']svix-timestamp["']\)/);
    expect(ROUTE_SRC).toMatch(/headers\.get\(["']svix-signature["']\)/);
  });

  it("delegates signature verification to verifyResendWebhook", () => {
    // Never roll a second MAC implementation in the route itself.
    expect(ROUTE_SRC).toMatch(
      /import[\s\S]*verifyResendWebhook[\s\S]*from\s+["']@\/lib\/mail\/resend-webhook["']/,
    );
    expect(ROUTE_SRC).toMatch(/verifyResendWebhook\(/);
  });

  it("503s when RESEND_WEBHOOK_SECRET is missing", () => {
    // Choosing 503 over 401 here is deliberate: the caller isn't
    // wrong, the server is misconfigured.
    expect(ROUTE_SRC).toMatch(/status:\s*503/);
  });

  it("413s on oversized payload", () => {
    expect(ROUTE_SRC).toMatch(/status:\s*413/);
  });

  it("401s on MAC mismatch, 400s on other malformed-request reasons", () => {
    // Both literals must appear somewhere in the handler. The exact
    // shape is `verifyResult.reason === "..." ? 401 : 400` plus a
    // `status: 400` for the JSON-parse failure branch.
    expect(ROUTE_SRC).toMatch(/\b401\b/);
    expect(ROUTE_SRC).toMatch(/status:\s*400/);
  });

  it("writes through db.user.updateMany on state-changing events", () => {
    // updateMany (not update) because we do not want the route to
    // 500 when the recipient doesn't map to a User — that would
    // cause Resend to retry forever on aliases / old addresses.
    expect(ROUTE_SRC).toMatch(/db\.user\.updateMany\(/);
    expect(ROUTE_SRC).toMatch(/emailStatus:\s*status/);
    expect(ROUTE_SRC).toMatch(/emailStatusUpdatedAt:\s*new Date\(\)/);
  });

  it("uses the canonical RESEND_STATE_CHANGING_EVENTS list", () => {
    // Pin the import path so adding an event in one place (the
    // mapper) automatically extends the route — no duplicate list.
    expect(ROUTE_SRC).toMatch(/RESEND_STATE_CHANGING_EVENTS/);
    expect(ROUTE_SRC).toMatch(/resendEventToStatus/);
  });

  it("lowercases the recipient before the DB write", () => {
    // Must match the canonicalization in DeliverabilityGuardMailer
    // or suppression won't take effect for mixed-case inputs.
    expect(ROUTE_SRC).toMatch(/toLowerCase\(\)/);
  });

  it("returns 200 on unknown-but-signed events (ack, no retry)", () => {
    // Resend treats non-2xx as a retry signal. Informational
    // events like email.sent/delivered/opened must 200 so they
    // aren't retried, even though we don't persist them.
    expect(ROUTE_SRC).toMatch(/processed:\s*false/);
  });
});
