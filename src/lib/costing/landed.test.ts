// src/lib/costing/landed.test.ts
//
// GOD MODE roadmap 2026-04-23 — P0-04 rc1.
//
// Pure-function tests for the landed-cost allocation algorithm.
// Covers: basis dispatch, fallback behaviour, rounding invariant,
// edge cases. Integration-level tests (PO receive → CostLayer)
// come in rc3.

import { describe, expect, it } from "vitest";

import {
  type AllocationBasis,
  LandedCostInputError,
  type LandedPOLine,
  allocateLanded,
} from "./landed";

const threeEqualLines: LandedPOLine[] = [
  { id: "l1", unitCost: 10, qty: 10 },
  { id: "l2", unitCost: 10, qty: 10 },
  { id: "l3", unitCost: 10, qty: 10 },
];

describe("allocateLanded — input validation", () => {
  it("throws on empty lines array", () => {
    expect(() =>
      allocateLanded({ basis: "BY_VALUE", freight: 30 }, []),
    ).toThrow(LandedCostInputError);
  });

  it("throws when a line has a non-finite unitCost", () => {
    expect(() =>
      allocateLanded({ basis: "BY_VALUE", freight: 30 }, [
        { id: "x", unitCost: Number.NaN, qty: 1 },
      ]),
    ).toThrow(/unitCost must be a non-negative finite number/);
  });

  it("throws when a line has a negative unitCost", () => {
    expect(() =>
      allocateLanded({ basis: "BY_VALUE", freight: 30 }, [
        { id: "x", unitCost: -1, qty: 1 },
      ]),
    ).toThrow(/unitCost must be a non-negative finite number/);
  });

  it("throws when a line has a non-integer qty", () => {
    expect(() =>
      allocateLanded({ basis: "BY_VALUE", freight: 30 }, [
        { id: "x", unitCost: 10, qty: 0.5 },
      ]),
    ).toThrow(/qty must be a positive integer/);
  });

  it("throws when a line has a zero or negative qty", () => {
    expect(() =>
      allocateLanded({ basis: "BY_VALUE", freight: 30 }, [
        { id: "x", unitCost: 10, qty: 0 },
      ]),
    ).toThrow(/qty must be a positive integer/);
  });

  it("throws when the id is missing", () => {
    expect(() =>
      allocateLanded({ basis: "BY_VALUE", freight: 30 }, [
        { id: "", unitCost: 10, qty: 1 },
      ]),
    ).toThrow(/line missing id/);
  });
});

describe("allocateLanded — zero total short-circuit", () => {
  it("returns zeros for every line when total landed is 0", () => {
    const out = allocateLanded({ basis: "BY_VALUE" }, threeEqualLines);
    for (const l of threeEqualLines) {
      const a = out.get(l.id)!;
      expect(a.freight).toBe(0);
      expect(a.duty).toBe(0);
      expect(a.insurance).toBe(0);
      expect(a.other).toBe(0);
      expect(a.landedUnitCost).toBe(l.unitCost);
    }
  });

  it("returns zeros when every landed field is null/undefined", () => {
    const out = allocateLanded(
      { basis: "BY_VALUE", freight: null, duty: null, insurance: null, other: null },
      threeEqualLines,
    );
    expect(out.get("l1")!.totalAllocated).toBe(0);
  });
});

describe("allocateLanded — BY_VALUE (default)", () => {
  it("splits freight evenly across equal-value lines", () => {
    const out = allocateLanded(
      { basis: "BY_VALUE", freight: 30 },
      threeEqualLines,
    );
    expect(out.get("l1")!.freight).toBe(10);
    expect(out.get("l2")!.freight).toBe(10);
    expect(out.get("l3")!.freight).toBe(10);
  });

  it("weights by extended value (unitCost × qty)", () => {
    // Line 1: $10 × 10 = $100 (20% of PO)
    // Line 2: $10 × 40 = $400 (80% of PO)
    // Freight $50 → $10 to L1, $40 to L2.
    const out = allocateLanded(
      { basis: "BY_VALUE", freight: 50 },
      [
        { id: "l1", unitCost: 10, qty: 10 },
        { id: "l2", unitCost: 10, qty: 40 },
      ],
    );
    expect(out.get("l1")!.freight).toBe(10);
    expect(out.get("l2")!.freight).toBe(40);
  });

  it("bumps landedUnitCost correctly (unitCost + allocation / qty)", () => {
    const out = allocateLanded(
      { basis: "BY_VALUE", freight: 30 },
      threeEqualLines,
    );
    // Each line gets $10 freight over 10 units → $1 / unit.
    // unitCost 10 → landedUnitCost 11.
    expect(out.get("l1")!.landedUnitCost).toBe(11);
  });
});

describe("allocateLanded — BY_QTY", () => {
  it("splits proportional to qty regardless of unitCost", () => {
    const out = allocateLanded(
      { basis: "BY_QTY", freight: 60 },
      [
        { id: "l1", unitCost: 100, qty: 10 },
        { id: "l2", unitCost: 1, qty: 20 },
      ],
    );
    // Total qty = 30. Freight $60 → $20 to L1 (10/30), $40 to L2.
    expect(out.get("l1")!.freight).toBe(20);
    expect(out.get("l2")!.freight).toBe(40);
  });
});

describe("allocateLanded — BY_WEIGHT + fallback", () => {
  it("uses weight × qty when weights are supplied", () => {
    const out = allocateLanded(
      { basis: "BY_WEIGHT", freight: 40 },
      [
        { id: "l1", unitCost: 5, qty: 10, weight: 2 }, // 20 total weight
        { id: "l2", unitCost: 5, qty: 5, weight: 4 }, // 20 total weight
      ],
    );
    // Equal total weight → $20 each.
    expect(out.get("l1")!.freight).toBe(20);
    expect(out.get("l2")!.freight).toBe(20);
  });

  it("falls back to BY_VALUE when no line has a weight", () => {
    const out = allocateLanded(
      { basis: "BY_WEIGHT", freight: 30 },
      threeEqualLines, // no weight → denom 0 → fallback
    );
    for (const l of threeEqualLines) {
      const a = out.get(l.id)!;
      expect(a.basisUsed).toBe("BY_VALUE");
      expect(a.freight).toBe(10);
    }
  });

  it("also works for BY_VOLUME fallback", () => {
    const out = allocateLanded(
      { basis: "BY_VOLUME", duty: 15 },
      threeEqualLines,
    );
    expect(out.get("l1")!.basisUsed).toBe("BY_VALUE");
    expect(out.get("l1")!.duty).toBe(5);
  });
});

describe("allocateLanded — invariant (sum equals header)", () => {
  const cases: Array<{
    label: string;
    header: Parameters<typeof allocateLanded>[0];
    lines: LandedPOLine[];
  }> = [
    {
      label: "50 lines, prime unit costs, BY_VALUE, nasty total",
      header: { basis: "BY_VALUE", freight: 1234.56, duty: 777.77, insurance: 0.01 },
      lines: Array.from({ length: 50 }, (_, i) => ({
        id: `l${i}`,
        unitCost: 1 + i * 0.13,
        qty: 1 + ((i * 7) % 17),
      })),
    },
    {
      label: "single line gets the whole allocation",
      header: { basis: "BY_VALUE", freight: 99.99, duty: 0.01 },
      lines: [{ id: "only", unitCost: 1.23, qty: 5 }],
    },
    {
      label: "BY_QTY with very unequal quantities",
      header: { basis: "BY_QTY", freight: 13.37 },
      lines: [
        { id: "a", unitCost: 1, qty: 1 },
        { id: "b", unitCost: 1, qty: 999 },
        { id: "c", unitCost: 1, qty: 7 },
      ],
    },
    {
      label: "BY_VALUE with mixed basis + all four components",
      header: {
        basis: "BY_VALUE",
        freight: 100,
        duty: 50,
        insurance: 25,
        other: 10,
      },
      lines: [
        { id: "a", unitCost: 10, qty: 3 },
        { id: "b", unitCost: 20, qty: 5 },
        { id: "c", unitCost: 30, qty: 2 },
      ],
    },
  ];

  // Floating-point aggregation at the output boundary is exact
  // enough because we divide each micro by exactly 1e6. But to
  // defend against future refactors, we tolerate a sub-micro drift.
  const TOLERANCE = 1e-6;

  for (const { label, header, lines } of cases) {
    it(label, () => {
      const out = allocateLanded(header, lines);
      expect(out.size).toBe(lines.length);

      let freight = 0;
      let duty = 0;
      let insurance = 0;
      let other = 0;
      for (const a of out.values()) {
        freight += a.freight;
        duty += a.duty;
        insurance += a.insurance;
        other += a.other;
      }
      expect(Math.abs(freight - (header.freight ?? 0))).toBeLessThan(TOLERANCE);
      expect(Math.abs(duty - (header.duty ?? 0))).toBeLessThan(TOLERANCE);
      expect(Math.abs(insurance - (header.insurance ?? 0))).toBeLessThan(TOLERANCE);
      expect(Math.abs(other - (header.other ?? 0))).toBeLessThan(TOLERANCE);
    });
  }
});

describe("allocateLanded — rounding drift absorption", () => {
  it("last line absorbs the cent a third-split can't spread evenly", () => {
    // $1.00 over 3 equal lines: each gets $0.33, last gets $0.34.
    // (0.333333... rounded to 6 decimals is 0.333333; 0.333333*3 =
    // 0.999999 ≠ 1.00, so the last line picks up the extra 0.000001.)
    const out = allocateLanded(
      { basis: "BY_VALUE", freight: 1 },
      threeEqualLines,
    );
    const amounts = ["l1", "l2", "l3"].map((id) => out.get(id)!.freight);
    const sum = amounts.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 9);
    // First two are identical, last absorbs the delta.
    expect(amounts[0]).toBe(amounts[1]);
    expect(amounts[2]).toBeGreaterThanOrEqual(amounts[0]!);
  });
});

describe("allocateLanded — basisUsed reflects actual path", () => {
  const bases: AllocationBasis[] = ["BY_VALUE", "BY_QTY"];
  for (const basis of bases) {
    it(`reports basisUsed="${basis}" when no fallback is needed`, () => {
      const out = allocateLanded(
        { basis, freight: 10 },
        threeEqualLines,
      );
      expect(out.get("l1")!.basisUsed).toBe(basis);
    });
  }
});
