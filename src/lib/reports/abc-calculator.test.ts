// src/lib/reports/abc-calculator.test.ts
//
// GOD MODE roadmap 2026-04-23 — P1-03 test coverage ratchet.
//
// Unit tests for the ABC/Pareto inventory classifier. Was 0%
// per the audit. Pure function + type-only Prisma import → no I/O.

import { describe, expect, it } from "vitest";

import { calculateABC, summarizeABC } from "./abc-calculator";

// Helper: build an ABC-shaped input item. Matches the
// `Pick<Item, "id" | "sku" | "name" | "costPrice"> & { quantity }`
// contract of calculateABC.
function make(
  id: string,
  costPrice: number,
  quantity: number,
): {
  id: string;
  sku: string;
  name: string;
  costPrice: number;
  quantity: number;
} {
  return {
    id,
    sku: `SKU-${id}`,
    name: `Item ${id}`,
    costPrice,
    quantity,
  };
}

describe("calculateABC — empty + edge cases", () => {
  it("returns [] on empty input", () => {
    expect(calculateABC([])).toEqual([]);
  });

  it("handles single-item PO (single result, always class A-ish)", () => {
    const out = calculateABC([make("1", 10, 5)]);
    expect(out).toHaveLength(1);
    expect(out[0]?.totalValue).toBe(50);
  });

  it("sorts by total value descending", () => {
    const out = calculateABC([
      make("low", 1, 1), // value 1
      make("high", 100, 10), // value 1000
      make("mid", 10, 10), // value 100
    ]);
    // ABCResult uses `itemId` (not `id`) — pins the interface shape
    // against a future accidental rename.
    expect(out.map((r) => r.itemId)).toEqual(["high", "mid", "low"]);
  });
});

describe("calculateABC — Pareto thresholds (defaults)", () => {
  it("top 20% of SKUs → class A", () => {
    // 10 items: top 2 (20%) should be A.
    const items = Array.from({ length: 10 }, (_, i) => make(`${i}`, (10 - i) * 10, 1));
    const out = calculateABC(items);
    const aCount = out.filter((r) => r.classification === "A").length;
    // 20% of 10 = 2
    expect(aCount).toBe(2);
  });

  it("cumulative percentage monotonically increases", () => {
    const items = Array.from({ length: 20 }, (_, i) => make(`${i}`, 100 - i, 1 + i));
    const out = calculateABC(items);
    let prev = 0;
    for (const r of out) {
      expect(r.cumulativePercentage).toBeGreaterThanOrEqual(prev);
      prev = r.cumulativePercentage;
    }
    // Final cumulative ≈ 100.
    expect(out[out.length - 1]?.cumulativePercentage).toBeGreaterThan(99.9);
  });

  it("assigns every item a class in {A, B, C}", () => {
    const items = Array.from({ length: 30 }, (_, i) => make(`${i}`, 1 + i, 1));
    const out = calculateABC(items);
    for (const r of out) {
      expect(["A", "B", "C"]).toContain(r.classification);
    }
  });
});

describe("calculateABC — custom value thresholds override Pareto", () => {
  it("aMinValue: items ≥ this land in A regardless of ranking", () => {
    const items = [make("a", 1000, 1), make("b", 500, 1), make("c", 1, 1)];
    const out = calculateABC(items, { aMinValue: 500, bMinValue: 50 });
    const byId = new Map(out.map((r) => [r.itemId, r.classification]));
    expect(byId.get("a")).toBe("A");
    expect(byId.get("b")).toBe("A");
    expect(byId.get("c")).toBe("C");
  });

  it("bMinValue: items between b and a thresholds land in B", () => {
    const items = [make("x", 200, 1)];
    const out = calculateABC(items, { aMinValue: 1000, bMinValue: 100 });
    expect(out[0]?.classification).toBe("B");
  });
});

describe("calculateABC — total value math", () => {
  it("totalValue = quantity × costPrice exactly", () => {
    const out = calculateABC([make("x", 2.5, 4)]);
    expect(out[0]?.totalValue).toBe(10);
  });

  it("percentageOfTotalValue sums to 100 (±1e-6)", () => {
    const items = Array.from({ length: 12 }, (_, i) => make(`${i}`, 1 + i, 1 + i));
    const out = calculateABC(items);
    const sum = out.reduce((acc, r) => acc + r.percentageOfTotalValue, 0);
    expect(Math.abs(sum - 100)).toBeLessThan(1e-6);
  });
});

describe("summarizeABC", () => {
  it("returns zeros on empty input", () => {
    const s = summarizeABC([]);
    expect(s.totalItems).toBe(0);
    expect(s.totalValue).toBe(0);
    expect(s.classA.percentage).toBe(0);
  });

  it("class totals sum to totalValue (no double-counting)", () => {
    const items = Array.from({ length: 15 }, (_, i) => make(`${i}`, 1 + i, 1 + i));
    const out = calculateABC(items);
    const s = summarizeABC(out);
    const combined = s.classA.value + s.classB.value + s.classC.value;
    expect(Math.abs(combined - s.totalValue)).toBeLessThan(1e-9);
  });

  it("class percentages sum to 100 (±1e-6) when there is value", () => {
    const items = Array.from({ length: 10 }, (_, i) => make(`${i}`, 5, 1 + i));
    const out = calculateABC(items);
    const s = summarizeABC(out);
    const pct = s.classA.percentage + s.classB.percentage + s.classC.percentage;
    expect(Math.abs(pct - 100)).toBeLessThan(1e-6);
  });

  it("counts match across classes", () => {
    const items = Array.from({ length: 20 }, (_, i) => make(`${i}`, 10 - (i % 5), 1));
    const out = calculateABC(items);
    const s = summarizeABC(out);
    expect(s.totalItems).toBe(20);
    expect(s.classA.count + s.classB.count + s.classC.count).toBe(20);
  });
});
