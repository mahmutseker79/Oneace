// P0-1 remediation test — billing routes must use the centralized
// `hasCapability(role, "org.billing")` check, not inline role strings.
//
// This test is a pure-logic guard that pins the capability map so we cannot
// silently widen billing access. It does NOT spin up Next.js — it asserts
// the permissions module matches the documented policy, which is what the
// route handlers consume.

import type { Role } from "@/generated/prisma";
import { hasCapability } from "@/lib/permissions";
import { describe, expect, it } from "vitest";

describe("P0-1 — billing capability guard", () => {
  const billingAllowed: Role[] = ["OWNER", "ADMIN"];
  const billingDenied: Role[] = ["MEMBER", "VIEWER", "APPROVER", "COUNTER", "MANAGER"];

  it.each(billingAllowed)("allows %s to manage billing", (role) => {
    expect(hasCapability(role, "org.billing")).toBe(true);
  });

  it.each(billingDenied)("denies %s from managing billing", (role) => {
    expect(hasCapability(role, "org.billing")).toBe(false);
  });
});
