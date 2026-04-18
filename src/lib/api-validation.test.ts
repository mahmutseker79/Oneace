// P3-3 (audit v1.1 §5.30) — API input-validation parity guard.
//
// Problem the audit called out: several route handlers parse their
// body with `request.json()` and then check fields inline (typeof,
// equality, regex). Inline checks drift: one branch adds `trim()`,
// another forgets to bound length, a third silently coerces. The
// fix is to make `zod` the only allowed schema seam — every route
// that consumes a JSON body MUST import `zod` AND call either
// `.safeParse(` or `.parse(` on a schema.
//
// This guard walks `src/app/api/**/route.ts` and enforces:
//
//   1. If the file references `request.json()` or `req.json()` (an
//      actual call, not a comment — we strip // line comments and
//      /* block comments */ before matching), it MUST import `zod`.
//   2. That same file MUST call a schema method — `.safeParse(` or
//      `.parse(`. The method can live on any schema name, which is
//      what makes this drift-proof: the test doesn't care about the
//      identifier, just that *some* parse happens.
//
// Webhook routes that read `request.text()` for signature
// verification (Stripe, Resend, Shopify) are exempt — they validate
// via HMAC, not schema, and their bodies are typed from a known
// provider payload.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..");
const API_ROOT = resolve(REPO_ROOT, "src", "app", "api");

/** Walk a directory and collect every `route.ts` file. */
function listRouteFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      out.push(...listRouteFiles(full));
    } else if (entry === "route.ts" || entry === "route.tsx") {
      out.push(full);
    }
  }
  return out;
}

// Strip block comments and line comments so string literals inside
// comments don't trip the regexes below.
function stripComments(source: string): string {
  return (
    source
      // Block comments.
      .replace(/\/\*[\s\S]*?\*\//g, "")
      // Line comments — keep the newline so line numbers roughly match.
      .replace(/(^|[^:"])\/\/[^\n]*/g, "$1")
  );
}

const ROUTE_FILES = listRouteFiles(API_ROOT);

// Routes that legitimately avoid zod because they parse raw body for
// HMAC signature verification. Keep this list narrow.
const SIGNATURE_EXEMPT = new Set<string>([
  resolve(API_ROOT, "webhooks", "resend", "route.ts"),
  resolve(API_ROOT, "webhooks", "inbound", "route.ts"),
  resolve(API_ROOT, "integrations", "shopify", "webhooks", "route.ts"),
  resolve(API_ROOT, "integrations", "quickbooks", "webhooks", "route.ts"),
]);

describe("P3-3 §5.30 — every JSON-body route validates with zod", () => {
  it("finds at least one route file to audit", () => {
    expect(ROUTE_FILES.length).toBeGreaterThan(0);
  });

  for (const file of ROUTE_FILES) {
    const rel = file.slice(REPO_ROOT.length + 1);
    const raw = readFileSync(file, "utf8");
    const code = stripComments(raw);
    const usesJson = /\b(?:request|req)\s*\.\s*json\s*\(/.test(code);
    if (!usesJson) continue;
    if (SIGNATURE_EXEMPT.has(file)) continue;

    describe(rel, () => {
      it("imports from 'zod'", () => {
        expect(
          /from\s+["']zod["']/.test(code),
          `${rel} calls request.json() but does not import zod — add a schema`,
        ).toBe(true);
      });

      it("calls .safeParse( or .parse( on a schema", () => {
        expect(
          /\.\s*(?:safeParse|parse)\s*\(/.test(code),
          `${rel} imports zod but never invokes .safeParse(/.parse() — inline validation is not acceptable`,
        ).toBe(true);
      });
    });
  }
});

describe("P3-3 §5.30 — named remediation targets are zod-validated", () => {
  // Explicit pin: the audit named these two routes specifically.
  // Even if the broad sweep above is relaxed, these two must stay
  // honest. Third route (two-factor/verify) added during remediation
  // when discovered it used the same inline pattern.
  const NAMED = [
    "src/app/api/billing/checkout/route.ts",
    "src/app/api/account/delete/route.ts",
    "src/app/api/auth/two-factor/verify/route.ts",
  ];
  for (const relative of NAMED) {
    const full = resolve(REPO_ROOT, relative);
    const code = stripComments(readFileSync(full, "utf8"));
    it(`${relative} uses zod`, () => {
      expect(/from\s+["']zod["']/.test(code)).toBe(true);
      expect(/\.\s*(?:safeParse|parse)\s*\(/.test(code)).toBe(true);
    });
  }
});
