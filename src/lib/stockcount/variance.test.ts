// P9.2 — regression tests for stock count variance calculation.
//
// Covers: aggregateEntries, classifyVariance, calculateVariances, and
// summarizeVariances. All pure functions — no DB or React dependency.

import { describe, expect, it } from "vitest";

import {
  aggregateEntries,
  calculateVariances,
  classifyVariance,
  summarizeVariances,
} from "./variance";

// ---------------------------------------------------------------------------
// aggregateEntries
// ---------------------------------------------------------------------------

describe("aggregateEntries", () => {
  it("sums counted quantities per (item, warehouse)", () => {
    const entries = [
      { itemId: "i1", warehouseId: "w1", countedQuantity: 3 },
      { itemId: "i1", warehouseId: "w1", countedQuantity: 7 },
      { itemId: "i1", warehouseId: "w2", countedQuantity: 5 },
    ];
    const totals = aggregateEntries(entries);
    expect(totals.get("i1::w1")).toBe(10);
    expect(totals.get("i1::w2")).toBe(5);
  });

  it("returns empty map for empty entries", () => {
    expect(aggregateEntries([]).size).toBe(0);
  });

  it("handles a single entry per scope", () => {
    const totals = aggregateEntries([{ itemId: "i1", warehouseId: "w1", countedQuantity: 42 }]);
    expect(totals.get("i1::w1")).toBe(42);
  });
});

// ---------------------------------------------------------------------------
// classifyVariance
// ---------------------------------------------------------------------------

describe("classifyVariance", () => {
  it("returns 'match' when counted equals expected", () => {
    const result = classifyVariance(10, 10);
    expect(result.status).toBe("match");
    expect(result.variance).toBe(0);
    expect(result.variancePercent).toBe(0);
  });

  it("returns 'over' when counted > expected", () => {
    const result = classifyVariance(10, 15);
    expect(result.status).toBe("over");
    expect(result.variance).toBe(5);
    expect(result.variancePercent).toBe(50);
  });

  it("returns 'under' when counted < expected", () => {
    const result = classifyVariance(10, 7);
    expect(result.status).toBe("under");
    expect(result.variance).toBe(-3);
    expect(result.variancePercent).toBeCloseTo(-30);
  });

  it("returns variancePercent null when expected is 0", () => {
    const result = classifyVariance(0, 5);
    expect(result.variancePercent).toBeNull();
    expect(result.status).toBe("over");
  });

  it("respects absolute tolerance", () => {
    const result = classifyVariance(100, 102, { absoluteTolerance: 5 });
    expect(result.status).toBe("within_tolerance");
  });

  it("respects percentage tolerance", () => {
    const result = classifyVariance(100, 103, { percentageTolerance: 5 });
    expect(result.status).toBe("within_tolerance");
  });

  it("outside absolute tolerance triggers over", () => {
    const result = classifyVariance(100, 110, { absoluteTolerance: 5 });
    expect(result.status).toBe("over");
  });
});

// ---------------------------------------------------------------------------
// calculateVariances
// ---------------------------------------------------------------------------

describe("calculateVariances", () => {
  it("produces one row per snapshot in order", () => {
    const snapshots = [
      { itemId: "i1", warehouseId: "w1", expectedQuantity: 10 },
      { itemId: "i2", warehouseId: "w1", expectedQuantity: 20 },
    ];
    const entries = [
      { itemId: "i1", warehouseId: "w1", countedQuantity: 10 },
      { itemId: "i2", warehouseId: "w1", countedQuantity: 18 },
    ];
    const rows = calculateVariances(snapshots, entries);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.status).toBe("match");
    expect(rows[1]?.variance).toBe(-2);
    expect(rows[1]?.status).toBe("under");
  });

  it("defaults to 0 counted when no entries exist for a snapshot", () => {
    const snapshots = [{ itemId: "i1", warehouseId: "w1", expectedQuantity: 5 }];
    const rows = calculateVariances(snapshots, []);
    expect(rows[0]?.countedQuantity).toBe(0);
    expect(rows[0]?.variance).toBe(-5);
  });

  it("aggregates multiple entries for the same scope", () => {
    const snapshots = [{ itemId: "i1", warehouseId: "w1", expectedQuantity: 10 }];
    const entries = [
      { itemId: "i1", warehouseId: "w1", countedQuantity: 3 },
      { itemId: "i1", warehouseId: "w1", countedQuantity: 4 },
      { itemId: "i1", warehouseId: "w1", countedQuantity: 3 },
    ];
    const rows = calculateVariances(snapshots, entries);
    expect(rows[0]?.countedQuantity).toBe(10);
    expect(rows[0]?.status).toBe("match");
  });

  it("ignores extra entry fields (e.g. binId) gracefully", () => {
    const snapshots = [{ itemId: "i1", warehouseId: "w1", expectedQuantity: 5 }];
    const entries = [{ itemId: "i1", warehouseId: "w1", countedQuantity: 5, binId: "bin-A" }];
    const rows = calculateVariances(snapshots, entries);
    expect(rows[0]?.status).toBe("match");
  });
});

// ---------------------------------------------------------------------------
// summarizeVariances
// ---------------------------------------------------------------------------

describe("summarizeVariances", () => {
  it("summarizes a mixed set of variance rows", () => {
    const rows = calculateVariances(
      [
        { itemId: "i1", warehouseId: "w1", expectedQuantity: 10 },
        { itemId: "i2", warehouseId: "w1", expectedQuantity: 20 },
        { itemId: "i3", warehouseId: "w1", expectedQuantity: 5 },
      ],
      [
        { itemId: "i1", warehouseId: "w1", countedQuantity: 10 }, // match
        { itemId: "i2", warehouseId: "w1", countedQuantity: 15 }, // under by 5
        { itemId: "i3", warehouseId: "w1", countedQuantity: 8 }, // over by 3
      ],
    );
    const summary = summarizeVariances(rows);
    expect(summary.totalItems).toBe(3);
    expect(summary.matched).toBe(1);
    expect(summary.over).toBe(1);
    expect(summary.under).toBe(1);
    expect(summary.netUnitVariance).toBe(-2); // 0 + (-5) + 3
    expect(summary.totalAbsVariance).toBe(8); // 0 + 5 + 3
  });

  it("handles all matching rows", () => {
    const rows = calculateVariances(
      [{ itemId: "i1", warehouseId: "w1", expectedQuantity: 7 }],
      [{ itemId: "i1", warehouseId: "w1", countedQuantity: 7 }],
    );
    const summary = summarizeVariances(rows);
    expect(summary.matched).toBe(1);
    expect(summary.netUnitVariance).toBe(0);
  });

  it("handles empty rows", () => {
    const summary = summarizeVariances([]);
    expect(summary.totalItems).toBe(0);
    expect(summary.netUnitVariance).toBe(0);
  });
});
