// God-Mode v2 §2.1 — debug-route gate policy pin.
//
// Static-analysis vitest over `isDebugRouteAllowed`. Mirrors the style
// of `src/middleware.public-routes.test.ts`: no route boot, no Prisma,
// just a matrix of inputs against the exported helper so the policy
// cannot silently regress (e.g. someone ships a fix that makes the
// debug route usable by MEMBER role in production).

import { describe, expect, it } from "vitest";

import { isDebugRouteAllowed } from "./debug-gate";

describe("debug-route gate", () => {
  // --- Non-production environments -------------------------------
  it("allows authenticated users in development", () => {
    expect(
      isDebugRouteAllowed({ nodeEnv: "development", enableDebugDashboard: false, role: "MEMBER" }),
    ).toBe(true);
    expect(
      isDebugRouteAllowed({ nodeEnv: "development", enableDebugDashboard: true, role: "OWNER" }),
    ).toBe(true);
  });

  it("allows authenticated users in test (CI/e2e)", () => {
    expect(
      isDebugRouteAllowed({ nodeEnv: "test", enableDebugDashboard: false, role: "VIEWER" }),
    ).toBe(true);
  });

  // --- Production is the hardening target ------------------------
  it("rejects MEMBER role in production even when the flag is on", () => {
    expect(
      isDebugRouteAllowed({ nodeEnv: "production", enableDebugDashboard: true, role: "MEMBER" }),
    ).toBe(false);
  });

  it("rejects VIEWER role in production even when the flag is on", () => {
    expect(
      isDebugRouteAllowed({ nodeEnv: "production", enableDebugDashboard: true, role: "VIEWER" }),
    ).toBe(false);
  });

  it("rejects ADMIN role in production even when the flag is on (OWNER only)", () => {
    expect(
      isDebugRouteAllowed({ nodeEnv: "production", enableDebugDashboard: true, role: "ADMIN" }),
    ).toBe(false);
  });

  it("rejects OWNER role in production when the flag is NOT set (default safe)", () => {
    expect(
      isDebugRouteAllowed({ nodeEnv: "production", enableDebugDashboard: false, role: "OWNER" }),
    ).toBe(false);
  });

  it("allows OWNER role in production ONLY when the flag is explicitly true", () => {
    expect(
      isDebugRouteAllowed({ nodeEnv: "production", enableDebugDashboard: true, role: "OWNER" }),
    ).toBe(true);
  });

  // --- Defensive check: unknown role string is not OWNER ---------
  it("treats unknown role strings as non-OWNER in production", () => {
    expect(
      isDebugRouteAllowed({ nodeEnv: "production", enableDebugDashboard: true, role: "owner" }),
    ).toBe(false);
    expect(
      isDebugRouteAllowed({ nodeEnv: "production", enableDebugDashboard: true, role: "" }),
    ).toBe(false);
  });
});
