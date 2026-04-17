import { sortCategoriesByParent } from "@/lib/migrations/core/topological-sort";
import type { RawCategory } from "@/lib/migrations/core/types";
import { describe, expect, it } from "vitest";

describe("topological-sort", () => {
  describe("sortCategoriesByParent", () => {
    it("sorts linear chain A→B→C in correct order", () => {
      const categories: RawCategory[] = [
        { externalId: "C", name: "C", parentExternalId: "B" },
        { externalId: "A", name: "A", parentExternalId: null },
        { externalId: "B", name: "B", parentExternalId: "A" },
      ];

      const result = sortCategoriesByParent(categories);
      expect(result.hasCycles).toBe(false);
      expect(result.sorted).toHaveLength(3);
      expect(result.sorted[0]?.externalId).toBe("A");
      expect(result.sorted[1]?.externalId).toBe("B");
      expect(result.sorted[2]?.externalId).toBe("C");
    });

    it("detects cycle A→B→A and marks as hasCycles=true", () => {
      const categories: RawCategory[] = [
        { externalId: "A", name: "A", parentExternalId: "B" },
        { externalId: "B", name: "B", parentExternalId: "A" },
      ];

      const result = sortCategoriesByParent(categories);
      expect(result.hasCycles).toBe(true);
      expect(result.cycleNodeIds.length).toBeGreaterThan(0);
      expect(result.cycleNodeIds).toContain("A");
      expect(result.cycleNodeIds).toContain("B");
      expect(result.issues.some((i) => i.code === "CATEGORY_CYCLE")).toBe(true);
    });

    it("returns hasCycles=false and all nodes for acyclic forest", () => {
      const categories: RawCategory[] = [
        { externalId: "A", name: "A", parentExternalId: null },
        { externalId: "B", name: "B", parentExternalId: null },
        { externalId: "C", name: "C", parentExternalId: "A" },
        { externalId: "D", name: "D", parentExternalId: "B" },
      ];

      const result = sortCategoriesByParent(categories);
      expect(result.hasCycles).toBe(false);
      expect(result.sorted).toHaveLength(4);
      // Parents before children
      const aIdx = result.sorted.findIndex((c) => c.externalId === "A");
      const cIdx = result.sorted.findIndex((c) => c.externalId === "C");
      expect(aIdx).toBeLessThan(cIdx);
    });

    it("includes orphan nodes (parent not in snapshot) in sorted, with warning", () => {
      const categories: RawCategory[] = [
        { externalId: "A", name: "A", parentExternalId: "nonexistent" },
        { externalId: "B", name: "B", parentExternalId: null },
      ];

      const result = sortCategoriesByParent(categories);
      expect(result.sorted).toHaveLength(2);
      expect(result.sorted.map((c) => c.externalId)).toContain("A");
    });

    it("sorts the same input identically on re-run (idempotent)", () => {
      const categories: RawCategory[] = [
        { externalId: "C", name: "C", parentExternalId: "B" },
        { externalId: "A", name: "A", parentExternalId: null },
        { externalId: "B", name: "B", parentExternalId: "A" },
      ];

      const result1 = sortCategoriesByParent(categories);
      const result2 = sortCategoriesByParent(categories);

      const ids1 = result1.sorted.map((c) => c.externalId);
      const ids2 = result2.sorted.map((c) => c.externalId);
      expect(ids1).toEqual(ids2);
    });

    it("filters out cyclic categories when returning sorted", () => {
      const categories: RawCategory[] = [
        { externalId: "A", name: "A", parentExternalId: "B" },
        { externalId: "B", name: "B", parentExternalId: "A" },
        { externalId: "C", name: "C", parentExternalId: null }, // Acyclic
      ];

      const result = sortCategoriesByParent(categories);
      expect(result.hasCycles).toBe(true);
      // Only C should be in sorted (A and B are part of cycle)
      expect(result.sorted).toHaveLength(1);
      expect(result.sorted[0]?.externalId).toBe("C");
    });

    it("records ERROR severity for cycles", () => {
      const categories: RawCategory[] = [
        { externalId: "A", name: "A", parentExternalId: "A" }, // Self-cycle
      ];

      const result = sortCategoriesByParent(categories);
      const error = result.issues.find((i) => i.severity === "ERROR");
      expect(error).toBeDefined();
      expect(error?.code).toBe("CATEGORY_CYCLE");
    });
  });
});
