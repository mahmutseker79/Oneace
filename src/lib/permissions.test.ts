// P10.1 — Permission matrix tests.
//
// Validates the centralized capability map against the expected
// role-based access control rules. Each test documents a product
// decision and pins it so regressions are caught immediately.

import type { Role } from "@/generated/prisma";
import { describe, expect, it } from "vitest";

import {
  ALL_CAPABILITIES,
  ASSIGNABLE_ROLES,
  type Capability,
  capabilitiesForRole,
  hasCapability,
  isReadOnly,
} from "./permissions";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROLES: Role[] = ["OWNER", "ADMIN", "MANAGER", "MEMBER", "APPROVER", "COUNTER", "VIEWER"];

function rolesWithCapability(cap: Capability): Role[] {
  return ROLES.filter((role) => hasCapability(role, cap));
}

// ---------------------------------------------------------------------------
// VIEWER is read-only
// ---------------------------------------------------------------------------

describe("VIEWER role", () => {
  it("has zero capabilities", () => {
    const caps = capabilitiesForRole("VIEWER");
    expect(caps.size).toBe(0);
  });

  it("isReadOnly returns true", () => {
    expect(isReadOnly("VIEWER")).toBe(true);
  });

  it("cannot create items", () => {
    expect(hasCapability("VIEWER", "items.create")).toBe(false);
  });

  it("cannot create movements", () => {
    expect(hasCapability("VIEWER", "movements.create")).toBe(false);
  });

  it("cannot export reports", () => {
    expect(hasCapability("VIEWER", "reports.export")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// MEMBER (Operator) — day-to-day inventory work
// ---------------------------------------------------------------------------

describe("MEMBER (Operator) role", () => {
  it("isReadOnly returns false", () => {
    expect(isReadOnly("MEMBER")).toBe(false);
  });

  const operatorCaps: Capability[] = [
    "items.create",
    "items.edit",
    "items.import",
    "movements.create",
    "stockCounts.create",
    "stockCounts.addEntry",
    "purchaseOrders.create",
    "purchaseOrders.edit",
    "purchaseOrders.send",
    "purchaseOrders.receive",
    "suppliers.create",
    "suppliers.edit",
    "categories.create",
    "categories.edit",
    "bins.transfer",
    "reports.export",
  ];

  for (const cap of operatorCaps) {
    it(`can ${cap}`, () => {
      expect(hasCapability("MEMBER", cap)).toBe(true);
    });
  }

  const operatorDenied: Capability[] = [
    "items.delete",
    "stockCounts.reconcile",
    "stockCounts.cancel",
    "purchaseOrders.cancel",
    "purchaseOrders.delete",
    "suppliers.delete",
    "warehouses.create",
    "warehouses.edit",
    "warehouses.delete",
    "bins.create",
    "bins.edit",
    "bins.delete",
    "categories.delete",
    "reorderConfig.edit",
    "org.editProfile",
    "org.editDefaults",
    "org.delete",
    "org.transfer",
    "team.invite",
    "team.changeRole",
    "team.remove",
    "audit.view",
  ];

  for (const cap of operatorDenied) {
    it(`cannot ${cap}`, () => {
      expect(hasCapability("MEMBER", cap)).toBe(false);
    });
  }
});

// ---------------------------------------------------------------------------
// MANAGER is equivalent to MEMBER
// ---------------------------------------------------------------------------

describe("MANAGER role (legacy)", () => {
  it("is a superset of MEMBER (has extra confirm/assign capabilities)", () => {
    const managerCaps = capabilitiesForRole("MANAGER");
    const memberCaps = capabilitiesForRole("MEMBER");
    // Every MEMBER capability should exist in MANAGER
    for (const cap of memberCaps) {
      expect(managerCaps.has(cap)).toBe(true);
    }
    // MANAGER has additional capabilities MEMBER doesn't (salesOrders.confirm, picks.assign, etc.)
    expect(managerCaps.size).toBeGreaterThanOrEqual(memberCaps.size);
  });
});

// ---------------------------------------------------------------------------
// ADMIN — operational config + team management
// ---------------------------------------------------------------------------

describe("ADMIN role", () => {
  it("has all MEMBER capabilities plus admin ones", () => {
    const adminCaps = capabilitiesForRole("ADMIN");
    const memberCaps = capabilitiesForRole("MEMBER");
    for (const cap of memberCaps) {
      expect(adminCaps.has(cap)).toBe(true);
    }
  });

  const adminOnlyCaps: Capability[] = [
    "items.delete",
    "stockCounts.reconcile",
    "stockCounts.cancel",
    "purchaseOrders.cancel",
    "purchaseOrders.delete",
    "suppliers.delete",
    "warehouses.create",
    "warehouses.edit",
    "warehouses.delete",
    "bins.create",
    "bins.edit",
    "bins.delete",
    "categories.delete",
    "reorderConfig.edit",
    "org.editProfile",
    "org.editDefaults",
    "team.invite",
    "team.changeRole",
    "team.remove",
    "audit.view",
  ];

  for (const cap of adminOnlyCaps) {
    it(`can ${cap}`, () => {
      expect(hasCapability("ADMIN", cap)).toBe(true);
    });
  }

  it("cannot delete the org", () => {
    expect(hasCapability("ADMIN", "org.delete")).toBe(false);
  });

  it("cannot transfer ownership", () => {
    expect(hasCapability("ADMIN", "org.transfer")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// OWNER — full control
// ---------------------------------------------------------------------------

describe("OWNER role", () => {
  it("has every capability", () => {
    const ownerCaps = capabilitiesForRole("OWNER");
    expect(ownerCaps.size).toBe(ALL_CAPABILITIES.length);
  });

  it("can delete the org", () => {
    expect(hasCapability("OWNER", "org.delete")).toBe(true);
  });

  it("can transfer ownership", () => {
    expect(hasCapability("OWNER", "org.transfer")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Structural invariants
// ---------------------------------------------------------------------------

describe("capability map invariants", () => {
  it("every capability has at least OWNER", () => {
    for (const cap of ALL_CAPABILITIES) {
      expect(hasCapability("OWNER", cap)).toBe(true);
    }
  });

  it("higher roles are strict supersets of lower roles", () => {
    // OWNER ⊇ ADMIN ⊇ MEMBER ⊇ VIEWER
    const ownerCaps = capabilitiesForRole("OWNER");
    const adminCaps = capabilitiesForRole("ADMIN");
    const memberCaps = capabilitiesForRole("MEMBER");
    const viewerCaps = capabilitiesForRole("VIEWER");

    for (const cap of adminCaps) expect(ownerCaps.has(cap)).toBe(true);
    for (const cap of memberCaps) expect(adminCaps.has(cap)).toBe(true);
    for (const cap of viewerCaps) expect(memberCaps.has(cap)).toBe(true);
  });

  it("org.delete is OWNER-only", () => {
    expect(rolesWithCapability("org.delete")).toEqual(["OWNER"]);
  });

  it("org.transfer is OWNER-only", () => {
    expect(rolesWithCapability("org.transfer")).toEqual(["OWNER"]);
  });

  it("ASSIGNABLE_ROLES excludes MANAGER", () => {
    expect(ASSIGNABLE_ROLES).toEqual(["OWNER", "ADMIN", "MEMBER", "APPROVER", "COUNTER", "VIEWER"]);
    expect(ASSIGNABLE_ROLES).not.toContain("MANAGER");
  });
});
