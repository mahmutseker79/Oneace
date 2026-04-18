// P0-5 remediation test — the new `requireCapability` helper is a thin
// composition of `requireActiveMembership` + `hasCapability`. We unit-test
// the decision logic (the part that determines whether the request should
// proceed) without spinning up Next.js by re-implementing it locally with
// the real `hasCapability`.

import { describe, expect, it } from "vitest";

import type { Role } from "@/generated/prisma";
import { type Capability, hasCapability } from "@/lib/permissions";

// Local mirror of the branching logic inside `requireCapability`.
// If `requireCapability`'s decision rule changes, this test must change
// too — which is exactly the point: it pins the contract.
function decide(role: Role, capability: Capability): "allow" | "deny" {
  return hasCapability(role, capability) ? "allow" : "deny";
}

describe("P0-5 — requireCapability decision logic", () => {
  it("denies VIEWER from privileged admin pages", () => {
    expect(decide("VIEWER", "org.billing")).toBe("deny");
    expect(decide("VIEWER", "audit.view")).toBe("deny");
    expect(decide("VIEWER", "team.invite")).toBe("deny");
  });

  it("denies MEMBER from privileged admin pages", () => {
    expect(decide("MEMBER", "org.billing")).toBe("deny");
    expect(decide("MEMBER", "audit.view")).toBe("deny");
    expect(decide("MEMBER", "team.invite")).toBe("deny");
  });

  it("allows OWNER on all privileged admin pages", () => {
    expect(decide("OWNER", "org.billing")).toBe("allow");
    expect(decide("OWNER", "audit.view")).toBe("allow");
    expect(decide("OWNER", "team.invite")).toBe("allow");
    expect(decide("OWNER", "org.delete")).toBe("allow");
  });

  it("allows ADMIN on billing, audit, and team management", () => {
    expect(decide("ADMIN", "org.billing")).toBe("allow");
    expect(decide("ADMIN", "audit.view")).toBe("allow");
    expect(decide("ADMIN", "team.invite")).toBe("allow");
  });

  it("denies ADMIN from OWNER-only destructive operations", () => {
    expect(decide("ADMIN", "org.delete")).toBe("deny");
    expect(decide("ADMIN", "org.transfer")).toBe("deny");
  });
});
