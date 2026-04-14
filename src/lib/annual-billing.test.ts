// Phase 15.1 — Annual billing logic tests.
// No DB, no SDK calls, no env dependency.

import { describe, expect, it } from "vitest";

type Interval = "month" | "year";
type Env = Record<string, string | undefined>;

function stripePriceIdForPlan(
  plan: "PRO" | "BUSINESS",
  env: Env,
  interval: Interval = "month",
): string | null {
  if (interval === "year") {
    if (plan === "PRO") return env.STRIPE_PRO_YEARLY_PRICE_ID ?? null;
    if (plan === "BUSINESS") return env.STRIPE_BUSINESS_YEARLY_PRICE_ID ?? null;
    return null;
  }
  if (plan === "PRO") return env.STRIPE_PRO_PRICE_ID ?? null;
  if (plan === "BUSINESS") return env.STRIPE_BUSINESS_PRICE_ID ?? null;
  return null;
}

function planForStripePriceId(priceId: string, env: Env): "PRO" | "BUSINESS" | null {
  if (priceId === env.STRIPE_PRO_PRICE_ID) return "PRO";
  if (priceId === env.STRIPE_BUSINESS_PRICE_ID) return "BUSINESS";
  if (priceId === env.STRIPE_PRO_YEARLY_PRICE_ID) return "PRO";
  if (priceId === env.STRIPE_BUSINESS_YEARLY_PRICE_ID) return "BUSINESS";
  return null;
}

function intervalForStripePriceId(priceId: string, env: Env): Interval | null {
  if (priceId === env.STRIPE_PRO_PRICE_ID || priceId === env.STRIPE_BUSINESS_PRICE_ID)
    return "month";
  if (priceId === env.STRIPE_PRO_YEARLY_PRICE_ID || priceId === env.STRIPE_BUSINESS_YEARLY_PRICE_ID)
    return "year";
  return null;
}

const M: Env = { STRIPE_PRO_PRICE_ID: "price_pro_m", STRIPE_BUSINESS_PRICE_ID: "price_biz_m" };
const F: Env = {
  ...M,
  STRIPE_PRO_YEARLY_PRICE_ID: "price_pro_y",
  STRIPE_BUSINESS_YEARLY_PRICE_ID: "price_biz_y",
};

describe("stripePriceIdForPlan — monthly only", () => {
  it("PRO monthly", () => expect(stripePriceIdForPlan("PRO", M, "month")).toBe("price_pro_m"));
  it("BUSINESS monthly", () =>
    expect(stripePriceIdForPlan("BUSINESS", M, "month")).toBe("price_biz_m"));
  it("PRO yearly → null", () => expect(stripePriceIdForPlan("PRO", M, "year")).toBeNull());
  it("BUSINESS yearly → null", () =>
    expect(stripePriceIdForPlan("BUSINESS", M, "year")).toBeNull());
  it("defaults to monthly", () => expect(stripePriceIdForPlan("PRO", M)).toBe("price_pro_m"));
});

describe("stripePriceIdForPlan — full env", () => {
  it("PRO monthly", () => expect(stripePriceIdForPlan("PRO", F, "month")).toBe("price_pro_m"));
  it("PRO yearly", () => expect(stripePriceIdForPlan("PRO", F, "year")).toBe("price_pro_y"));
  it("BUSINESS monthly", () =>
    expect(stripePriceIdForPlan("BUSINESS", F, "month")).toBe("price_biz_m"));
  it("BUSINESS yearly", () =>
    expect(stripePriceIdForPlan("BUSINESS", F, "year")).toBe("price_biz_y"));
});

describe("planForStripePriceId", () => {
  it("monthly PRO → PRO", () => expect(planForStripePriceId("price_pro_m", F)).toBe("PRO"));
  it("monthly BIZ → BUSINESS", () =>
    expect(planForStripePriceId("price_biz_m", F)).toBe("BUSINESS"));
  it("yearly PRO → PRO (same tier)", () =>
    expect(planForStripePriceId("price_pro_y", F)).toBe("PRO"));
  it("yearly BIZ → BUSINESS (same tier)", () =>
    expect(planForStripePriceId("price_biz_y", F)).toBe("BUSINESS"));
  it("unknown → null", () => expect(planForStripePriceId("price_x", F)).toBeNull());
});

describe("intervalForStripePriceId", () => {
  it("monthly PRO → month", () => expect(intervalForStripePriceId("price_pro_m", F)).toBe("month"));
  it("monthly BIZ → month", () => expect(intervalForStripePriceId("price_biz_m", F)).toBe("month"));
  it("yearly PRO → year", () => expect(intervalForStripePriceId("price_pro_y", F)).toBe("year"));
  it("yearly BIZ → year", () => expect(intervalForStripePriceId("price_biz_y", F)).toBe("year"));
  it("unknown → null", () => expect(intervalForStripePriceId("price_x", F)).toBeNull());
});

describe("tier invariant: same tier for both intervals", () => {
  it("annual PRO = monthly PRO", () =>
    expect(planForStripePriceId("price_pro_y", F)).toBe(planForStripePriceId("price_pro_m", F)));
  it("annual BIZ = monthly BIZ", () =>
    expect(planForStripePriceId("price_biz_y", F)).toBe(planForStripePriceId("price_biz_m", F)));
  it("annual PRO ≠ BUSINESS", () =>
    expect(planForStripePriceId("price_pro_y", F)).not.toBe("BUSINESS"));
  it("annual BIZ ≠ PRO", () => expect(planForStripePriceId("price_biz_y", F)).not.toBe("PRO"));
});

describe("fallback behavior", () => {
  it("yearly request without yearly config → null (caller falls back to monthly)", () => {
    expect(stripePriceIdForPlan("PRO", M, "year")).toBeNull();
    expect(stripePriceIdForPlan("PRO", M, "month")).toBe("price_pro_m");
  });
});

describe("annual discount math", () => {
  it("PRO annual saves ~21% vs monthly annualized", () => {
    const saving = Math.round((1 - 276 / (29 * 12)) * 100);
    expect(saving).toBe(21);
  });
  it("BUSINESS annual saves 20% vs monthly annualized", () => {
    const saving = Math.round((1 - 756 / (79 * 12)) * 100);
    expect(saving).toBe(20);
  });
});
