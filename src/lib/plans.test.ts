// Phase 13.1 — Plan capability model tests.
//
// Every capability and every limit is tested for every plan so
// a future edit to plans.ts can't silently regress enforcement.

import { describe, expect, it } from "vitest";

import {
  UNLIMITED,
  checkPlanLimit,
  getPlanLimit,
  hasPlanCapability,
  planCapabilityError,
  planLimitError,
  requiredPlanFor,
} from "./plans";

// ---------------------------------------------------------------------------
// hasPlanCapability
// ---------------------------------------------------------------------------

describe("hasPlanCapability — FREE", () => {
  it("bins: false", () => expect(hasPlanCapability("FREE", "bins")).toBe(false));
  it("purchaseOrders: false", () =>
    expect(hasPlanCapability("FREE", "purchaseOrders")).toBe(false));
  it("exports: false", () => expect(hasPlanCapability("FREE", "exports")).toBe(false));
  it("reports: false", () => expect(hasPlanCapability("FREE", "reports")).toBe(false));
  it("transfers: false", () => expect(hasPlanCapability("FREE", "transfers")).toBe(false));
  it("auditLog: false", () => expect(hasPlanCapability("FREE", "auditLog")).toBe(false));
  it("lowStockAlerts: false", () =>
    expect(hasPlanCapability("FREE", "lowStockAlerts")).toBe(false));
});

describe("hasPlanCapability — PRO", () => {
  it("bins: true", () => expect(hasPlanCapability("PRO", "bins")).toBe(true));
  it("purchaseOrders: true", () => expect(hasPlanCapability("PRO", "purchaseOrders")).toBe(true));
  it("exports: true", () => expect(hasPlanCapability("PRO", "exports")).toBe(true));
  it("reports: true", () => expect(hasPlanCapability("PRO", "reports")).toBe(true));
  it("transfers: true", () => expect(hasPlanCapability("PRO", "transfers")).toBe(true));
  it("auditLog: false on PRO", () => expect(hasPlanCapability("PRO", "auditLog")).toBe(false));
  it("lowStockAlerts: true", () => expect(hasPlanCapability("PRO", "lowStockAlerts")).toBe(true));
});

describe("hasPlanCapability — BUSINESS", () => {
  it("bins: true", () => expect(hasPlanCapability("BUSINESS", "bins")).toBe(true));
  it("purchaseOrders: true", () =>
    expect(hasPlanCapability("BUSINESS", "purchaseOrders")).toBe(true));
  it("exports: true", () => expect(hasPlanCapability("BUSINESS", "exports")).toBe(true));
  it("reports: true", () => expect(hasPlanCapability("BUSINESS", "reports")).toBe(true));
  it("transfers: true", () => expect(hasPlanCapability("BUSINESS", "transfers")).toBe(true));
  it("auditLog: true on BUSINESS", () =>
    expect(hasPlanCapability("BUSINESS", "auditLog")).toBe(true));
  it("lowStockAlerts: true", () =>
    expect(hasPlanCapability("BUSINESS", "lowStockAlerts")).toBe(true));
});

// ---------------------------------------------------------------------------
// getPlanLimit
// ---------------------------------------------------------------------------

describe("getPlanLimit — FREE", () => {
  it("items: 100", () => expect(getPlanLimit("FREE", "items")).toBe(100));
  it("warehouses: 1", () => expect(getPlanLimit("FREE", "warehouses")).toBe(1));
  it("members: 3", () => expect(getPlanLimit("FREE", "members")).toBe(3));
});

describe("getPlanLimit — PRO", () => {
  it("items: UNLIMITED", () => expect(getPlanLimit("PRO", "items")).toBe(UNLIMITED));
  it("warehouses: UNLIMITED", () => expect(getPlanLimit("PRO", "warehouses")).toBe(UNLIMITED));
  it("members: 10", () => expect(getPlanLimit("PRO", "members")).toBe(10));
});

describe("getPlanLimit — BUSINESS", () => {
  it("items: UNLIMITED", () => expect(getPlanLimit("BUSINESS", "items")).toBe(UNLIMITED));
  it("warehouses: UNLIMITED", () => expect(getPlanLimit("BUSINESS", "warehouses")).toBe(UNLIMITED));
  it("members: UNLIMITED", () => expect(getPlanLimit("BUSINESS", "members")).toBe(UNLIMITED));
});

// ---------------------------------------------------------------------------
// checkPlanLimit
// ---------------------------------------------------------------------------

describe("checkPlanLimit — FREE items", () => {
  it("99 items → allowed", () => {
    expect(checkPlanLimit("FREE", "items", 99)).toEqual({ allowed: true });
  });

  it("100 items → still under limit (100th item can be created when current is 99)", () => {
    // currentCount is the CURRENT count before creation — so 99 means the 100th is ok
    expect(checkPlanLimit("FREE", "items", 99)).toEqual({ allowed: true });
  });

  it("100 items already → blocked (can't create 101st)", () => {
    const result = checkPlanLimit("FREE", "items", 100);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.limit).toBe(100);
      expect(result.current).toBe(100);
    }
  });

  it("150 items → blocked", () => {
    const result = checkPlanLimit("FREE", "items", 150);
    expect(result.allowed).toBe(false);
  });
});

describe("checkPlanLimit — FREE warehouses", () => {
  it("0 warehouses → allowed", () => {
    expect(checkPlanLimit("FREE", "warehouses", 0)).toEqual({ allowed: true });
  });

  it("1 warehouse already → blocked", () => {
    const result = checkPlanLimit("FREE", "warehouses", 1);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.limit).toBe(1);
    }
  });
});

describe("checkPlanLimit — PRO members", () => {
  it("9 members → allowed", () => {
    expect(checkPlanLimit("PRO", "members", 9)).toEqual({ allowed: true });
  });

  it("10 members → blocked", () => {
    const result = checkPlanLimit("PRO", "members", 10);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.limit).toBe(10);
    }
  });
});

describe("checkPlanLimit — PRO/BUSINESS items (unlimited)", () => {
  it("PRO: 10000 items → allowed", () => {
    expect(checkPlanLimit("PRO", "items", 10000)).toEqual({ allowed: true });
  });

  it("BUSINESS: 99999 items → allowed", () => {
    expect(checkPlanLimit("BUSINESS", "items", 99999)).toEqual({ allowed: true });
  });
});

// ---------------------------------------------------------------------------
// planCapabilityError
// ---------------------------------------------------------------------------

describe("planCapabilityError — returns non-empty strings", () => {
  const capabilities = [
    "bins",
    "purchaseOrders",
    "exports",
    "reports",
    "transfers",
    "auditLog",
    "lowStockAlerts",
  ] as const;

  for (const cap of capabilities) {
    it(`${cap} returns a non-empty string`, () => {
      expect(planCapabilityError(cap)).toBeTruthy();
      expect(typeof planCapabilityError(cap)).toBe("string");
    });
  }

  it("auditLog mentions Business plan", () => {
    expect(planCapabilityError("auditLog")).toMatch(/business/i);
  });

  it("bins mentions Pro plan", () => {
    expect(planCapabilityError("bins")).toMatch(/pro/i);
  });
});

// ---------------------------------------------------------------------------
// planLimitError
// ---------------------------------------------------------------------------

describe("planLimitError", () => {
  it("items error mentions limit and upgrade to Pro", () => {
    const msg = planLimitError("items", { allowed: false, limit: 100, current: 100 });
    expect(msg).toMatch(/100/);
    expect(msg).toMatch(/pro/i);
  });

  it("warehouses error mentions 1 location", () => {
    const msg = planLimitError("warehouses", { allowed: false, limit: 1, current: 1 });
    expect(msg).toMatch(/1/);
  });

  it("members error at FREE (3) mentions Pro", () => {
    const msg = planLimitError("members", { allowed: false, limit: 3, current: 3 });
    expect(msg).toMatch(/pro/i);
  });

  it("members error at PRO (10) mentions Business", () => {
    const msg = planLimitError("members", { allowed: false, limit: 10, current: 10 });
    expect(msg).toMatch(/business/i);
  });
});

// ---------------------------------------------------------------------------
// requiredPlanFor
// ---------------------------------------------------------------------------

describe("requiredPlanFor", () => {
  it("auditLog requires BUSINESS", () => {
    expect(requiredPlanFor("auditLog")).toBe("BUSINESS");
  });

  it("bins requires PRO", () => {
    expect(requiredPlanFor("bins")).toBe("PRO");
  });

  it("exports requires PRO", () => {
    expect(requiredPlanFor("exports")).toBe("PRO");
  });

  it("purchaseOrders requires PRO", () => {
    expect(requiredPlanFor("purchaseOrders")).toBe("PRO");
  });

  it("transfers requires PRO", () => {
    expect(requiredPlanFor("transfers")).toBe("PRO");
  });
});
