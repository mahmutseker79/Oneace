// God-Mode v2 §1 — public-route policy pin.
//
// This vitest pins the middleware's public-path classifier so any
// regression of Phase 1's fixes (invite flow breaks for signed-out
// users, legal pages gated, reset-password gated) shows up in CI
// before hitting users.
//
// Scope-wise this is a pure static-analysis test: we import the
// exported `isPublicPath` helper directly and assert against a
// matrix of canonical paths. No NextRequest, no runtime boot — which
// is the style the rest of the codebase uses for middleware contracts
// (e.g. `src/lib/api-rate-limit-coverage.test.ts`).

import { describe, expect, it } from "vitest";

import { isPublicPath } from "./middleware";

describe("middleware public-path classifier", () => {
  // --- Phase 1 remediations --------------------------------------
  it("treats /invite/<token> as public for signed-out invitees", () => {
    expect(isPublicPath("/invite/abc123")).toBe(true);
    expect(isPublicPath("/invite/xyz_789")).toBe(true);
  });

  it("treats /legal/terms and /legal/privacy as public", () => {
    expect(isPublicPath("/legal/terms")).toBe(true);
    expect(isPublicPath("/legal/privacy")).toBe(true);
  });

  it("treats /reset-password as public (users reaching it have no session)", () => {
    expect(isPublicPath("/reset-password")).toBe(true);
  });

  it("treats /forgot-password as public", () => {
    expect(isPublicPath("/forgot-password")).toBe(true);
  });

  // --- Sanity: existing public routes stay public ----------------
  it("keeps the landing page, /login, /register, /pricing public", () => {
    for (const path of ["/", "/login", "/register", "/pricing"]) {
      expect(isPublicPath(path), `expected ${path} to be public`).toBe(true);
    }
  });

  it("keeps /api/auth/* public (Better Auth handler)", () => {
    expect(isPublicPath("/api/auth/sign-in")).toBe(true);
    expect(isPublicPath("/api/auth/sign-up")).toBe(true);
  });

  it("keeps /_next/* and static assets public", () => {
    expect(isPublicPath("/_next/static/chunks/main.js")).toBe(true);
    // Paths containing a dot are treated as static (e.g. favicon.ico).
    expect(isPublicPath("/favicon.ico")).toBe(true);
    expect(isPublicPath("/robots.txt")).toBe(true);
  });

  it("keeps external-webhook paths public", () => {
    for (const path of [
      "/api/billing/webhook",
      "/api/integrations/shopify/webhooks",
      "/api/integrations/quickbooks/webhooks",
      "/api/webhooks/inbound",
      "/api/health",
      "/api/cron/refresh-rates",
    ]) {
      expect(isPublicPath(path), `expected ${path} to be public`).toBe(true);
    }
  });

  // --- Negative controls: private routes remain private ----------
  it("keeps authenticated app routes private", () => {
    for (const path of [
      "/dashboard",
      "/onboarding",
      "/items",
      "/warehouses",
      "/stock-counts",
      "/settings",
      "/reports",
      "/api/account/delete",
      "/api/onboarding/organization",
    ]) {
      expect(isPublicPath(path), `expected ${path} to be PRIVATE`).toBe(false);
    }
  });

  it("does not accidentally match prefix look-alikes", () => {
    // /invitee (fictional) must not match /invite/
    expect(isPublicPath("/invitee-portal")).toBe(false);
    // /legal-review admin page must not match /legal/
    expect(isPublicPath("/legal-review")).toBe(false);
    // /reset-password-admin admin page must not match /reset-password
    // exactly. (PUBLIC_PATHS uses exact equality so this is fine.)
    expect(isPublicPath("/reset-password-admin")).toBe(false);
  });
});
