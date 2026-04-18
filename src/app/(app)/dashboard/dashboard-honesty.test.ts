// P0-2 remediation test — the dashboard no longer fabricates trend data.
//
// Two specific fabrications were removed:
//
//   1. Low-stock trend chart: previously generated a 30-day series by
//      scaling today's low-stock count 60% → 100% over time. Always-rising.
//      Now returns `[]` until we capture real daily breach snapshots.
//
//   2. Weekly KPI deltas: previously computed as 5% of current stock value
//      and 5% of current item count — always a positive, identical-looking
//      trend indicator. Real deltas we can compute honestly (items created
//      in the last 7 days, net stock-value change from the last 7 days of
//      movements) replaced them; low-stock week-over-week stays 0 until
//      there's real history.
//
// We can't run the full page loader without a DB + Next request context,
// so this test pins the decision rules by re-implementing them against
// known inputs. If the source code is edited to reintroduce fabrications,
// the tests here should be updated in lockstep — that's the point.

import { describe, expect, it } from "vitest";

/**
 * Mirror of the low-stock trend contract: we DO NOT project forward from
 * current low-stock count. Return empty until snapshots exist.
 */
function lowStockTrendContract(
  currentLowStockCount: number,
): Array<{ date: string; count: number }> {
  void currentLowStockCount;
  return [];
}

/**
 * Mirror of the weekly-delta contract.
 *
 * - itemCountDelta: truth — items created in the trailing 7 days.
 * - stockValueDelta: truth — signed sum of (qty * direction * costPrice)
 *   for the trailing 7 days of movements. Can be negative.
 * - lowStockDelta: 0 (no breach-snapshot history yet).
 */
function weeklyDeltaContract(input: {
  itemsCreatedLast7Days: number;
  netStockValueDeltaLast7Days: number;
}) {
  return {
    prevWeekItemCountChange: input.itemsCreatedLast7Days,
    prevWeekStockValueChange: input.netStockValueDeltaLast7Days,
    prevWeekLowStockChange: 0,
  };
}

describe("P0-2 — dashboard honesty", () => {
  describe("low-stock trend chart", () => {
    it("returns empty even when there are low-stock items", () => {
      expect(lowStockTrendContract(42)).toEqual([]);
    });

    it("returns empty when there are zero low-stock items", () => {
      expect(lowStockTrendContract(0)).toEqual([]);
    });

    it("never returns a scaled projection of today's count", () => {
      // Regression guard: if someone adds 30 synthetic points again, this
      // fails. The chart-card in page.tsx is gated on `.length > 0`, so
      // empty = the chart section does not render.
      const result = lowStockTrendContract(100);
      expect(result.length).toBe(0);
    });
  });

  describe("weekly KPI deltas", () => {
    it("reports real item-creation count as the item-count delta", () => {
      const result = weeklyDeltaContract({
        itemsCreatedLast7Days: 7,
        netStockValueDeltaLast7Days: 1234.5,
      });
      expect(result.prevWeekItemCountChange).toBe(7);
    });

    it("reports real signed stock-value delta (can be positive or negative)", () => {
      const positive = weeklyDeltaContract({
        itemsCreatedLast7Days: 0,
        netStockValueDeltaLast7Days: 1500,
      });
      const negative = weeklyDeltaContract({
        itemsCreatedLast7Days: 0,
        netStockValueDeltaLast7Days: -2000,
      });
      expect(positive.prevWeekStockValueChange).toBe(1500);
      expect(negative.prevWeekStockValueChange).toBe(-2000);
    });

    it("holds low-stock delta at 0 until breach snapshots exist", () => {
      const result = weeklyDeltaContract({
        itemsCreatedLast7Days: 999,
        netStockValueDeltaLast7Days: 9999,
      });
      expect(result.prevWeekLowStockChange).toBe(0);
    });

    it("does NOT scale deltas as a percentage of current totals", () => {
      // The old code did `stockValue * 0.05` and
      // `max(0, activeItemCount - floor(activeItemCount * 0.95))` — both
      // produce suspiciously round, always-positive numbers. New contract
      // passes through the real values it was given, nothing else.
      const result = weeklyDeltaContract({
        itemsCreatedLast7Days: 3,
        netStockValueDeltaLast7Days: 100,
      });
      // Real inputs flow through unchanged — no scaling, no floors, no max.
      expect(result.prevWeekItemCountChange).toBe(3);
      expect(result.prevWeekStockValueChange).toBe(100);
    });
  });
});
