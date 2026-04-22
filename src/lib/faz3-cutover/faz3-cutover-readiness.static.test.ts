// Faz 3 Netlify cutover readiness — pinned static-analysis test.
//
// WHY: Faz 3 cutover flips production DNS + webhook URLs from Vercel
// to Netlify. The migration is not a code change — it's an
// infrastructure operation. But a handful of code-level invariants
// MUST hold before we flip, or the cutover fails silently:
//
//   (1) Webhook handlers (Shopify, QuickBooks) must not hardcode any
//       platform-specific host assumption. Shopify/QB resolve the
//       webhook URL externally (admin panel / developer portal), so
//       the route code must be host-agnostic. Any `vercel.app` literal
//       in a route handler is a leak that will break post-cutover.
//
//   (2) better-auth `trustedOrigins` MUST include the netlify.app
//       fallback origin. During the cutover window the env var
//       `NEXT_PUBLIC_APP_URL` may lag the DNS flip — if it does, and
//       the fallback list only has vercel.app, sessions get rejected
//       on the netlify origin and users get logged out.
//
//   (3) Faz 3 runbook doc must exist and be in sync with this test.
//
// Scope: node-only, no build, no network. Pure grep-and-assert.
//
// When this test needs updating:
//   - Post-cutover cleanup removes vercel.app from trustedOrigins →
//     update the assertion, delete the vercel arm of the OR.
//   - Adding a new webhook provider (e.g., Paraşüt) → extend
//     WEBHOOK_ROUTES with the new route path.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..", "..");

function read(rel: string): string {
  return readFileSync(resolve(REPO_ROOT, rel), "utf8");
}

// All webhook route handlers that Faz 3 cutover affects. Each of
// these must be host-agnostic — no literal hostnames in the code.
const WEBHOOK_ROUTES = [
  "src/app/api/integrations/shopify/webhooks/route.ts",
  "src/app/api/integrations/quickbooks/webhooks/route.ts",
];

describe("Faz 3 cutover — webhook routes are host-agnostic", () => {
  for (const route of WEBHOOK_ROUTES) {
    it(`${route} has no hardcoded vercel.app or netlify.app hostnames`, () => {
      const src = read(route);
      // Allow comments to mention cutover context, but not live code.
      const codeOnly = src.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");
      expect(codeOnly).not.toMatch(/vercel\.app/);
      expect(codeOnly).not.toMatch(/netlify\.app/);
    });

    it(`${route} exists and is a POST handler`, () => {
      const src = read(route);
      expect(src).toMatch(/export\s+async\s+function\s+POST/);
    });
  }
});

describe("Faz 3 cutover — better-auth trustedOrigins cover both platforms", () => {
  const auth = read("src/lib/auth.ts");

  it("includes the Vercel fallback origin", () => {
    expect(auth).toMatch(/oneace-next-local\.vercel\.app/);
  });

  it("includes the Netlify fallback origin (Faz 3 requirement)", () => {
    expect(auth).toMatch(/oneace-next-local\.netlify\.app/);
  });

  it("both fallbacks are guarded behind the NEXT_PUBLIC_APP_URL ternary", () => {
    // The fallback arm should only be used when the prod env var is
    // not set. Otherwise we'd permanently accept two origins in prod,
    // which would be a minor auth surface expansion we don't need.
    expect(auth).toMatch(/NEXT_PUBLIC_APP_URL[\s\S]{0,400}oneace-next-local\.netlify\.app/);
  });
});

describe("Faz 3 cutover — runbook doc exists", () => {
  it("docs/FAZ-3-CUTOVER-RUNBOOK.md is present", () => {
    expect(existsSync(resolve(REPO_ROOT, "docs/FAZ-3-CUTOVER-RUNBOOK.md"))).toBe(true);
  });

  it("runbook covers the 5 cutover phases (T-48h, T-24h, T-12h, T-0, T+7d)", () => {
    const doc = read("docs/FAZ-3-CUTOVER-RUNBOOK.md");
    for (const marker of ["T-48h", "T-24h", "T-12h", "T-0", "T+7d"]) {
      expect(doc).toContain(marker);
    }
  });

  it("runbook names both webhook providers", () => {
    const doc = read("docs/FAZ-3-CUTOVER-RUNBOOK.md");
    expect(doc).toMatch(/Shopify/i);
    expect(doc).toMatch(/QuickBooks/i);
  });

  it("runbook documents the rollback path", () => {
    const doc = read("docs/FAZ-3-CUTOVER-RUNBOOK.md");
    expect(doc).toMatch(/rollback|geri alma|revert/i);
  });
});
