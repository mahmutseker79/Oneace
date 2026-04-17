import { getSourceAbbreviation, resolveSku } from "@/lib/migrations/core/conflict-resolver";
import type { ConflictCheckContext } from "@/lib/migrations/core/conflict-resolver";
import { describe, expect, it } from "vitest";

describe("conflict-resolver", () => {
  describe("getSourceAbbreviation", () => {
    it("returns SRT for SORTLY", () => {
      expect(getSourceAbbreviation("SORTLY")).toBe("SRT");
    });

    it("returns IFL for INFLOW", () => {
      expect(getSourceAbbreviation("INFLOW")).toBe("IFL");
    });

    it("returns FBL for FISHBOWL", () => {
      expect(getSourceAbbreviation("FISHBOWL")).toBe("FBL");
    });

    it("returns C7C for CIN7_CORE", () => {
      expect(getSourceAbbreviation("CIN7_CORE")).toBe("C7C");
    });

    it("returns SOS for SOS_INVENTORY", () => {
      expect(getSourceAbbreviation("SOS_INVENTORY")).toBe("SOS");
    });

    it("returns fallback abbreviation for unknown sources", () => {
      const result = getSourceAbbreviation("QUICKBOOKS_ONLINE" as any);
      // Should be first 3 chars uppercase
      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("resolveSku", () => {
    const createContext = (
      policy: any = "APPEND_SOURCE_SUFFIX" as const,
    ): ConflictCheckContext => ({
      db: {} as any,
      organizationId: "org-1",
      source: "SORTLY",
      policy,
    });

    it("returns original SKU with wasModified=false when no collision", () => {
      const ctx = createContext();
      const result = resolveSku(ctx, "WIDGET", "ext-widget-1", undefined);

      expect(result.finalSku).toBe("WIDGET");
      expect(result.wasModified).toBe(false);
      expect(result.shouldSkip).toBe(false);
      expect(result.issue).toBeNull();
    });

    it("returns original SKU when updating same item (same source + externalId)", () => {
      const ctx = createContext();
      const result = resolveSku(ctx, "WIDGET", "ext-widget-1", {
        externalId: "ext-widget-1",
        externalSource: "SORTLY",
      });

      expect(result.finalSku).toBe("WIDGET");
      expect(result.wasModified).toBe(false);
    });

    it("appends -SRT suffix under APPEND_SOURCE_SUFFIX policy", () => {
      const ctx = createContext("APPEND_SOURCE_SUFFIX");
      const result = resolveSku(ctx, "WIDGET", "ext-widget-new", {
        externalId: "ext-widget-old",
        externalSource: "INFLOW",
      });

      expect(result.finalSku).toBe("WIDGET-SRT");
      expect(result.wasModified).toBe(true);
    });

    it("marks shouldSkip=true under SKIP policy", () => {
      const ctx = createContext("SKIP");
      const result = resolveSku(ctx, "WIDGET", "ext-widget-new", {
        externalId: "ext-widget-old",
        externalSource: "INFLOW",
      });

      expect(result.shouldSkip).toBe(true);
      expect(result.issue?.code).toBe("SKU_COLLISION_SKIPPED");
    });

    it("throws error under MERGE_BY_EXTERNAL_ID policy on collision", () => {
      const ctx = createContext("MERGE_BY_EXTERNAL_ID");
      expect(() =>
        resolveSku(ctx, "WIDGET", "ext-widget-new", {
          externalId: "ext-widget-old",
          externalSource: "INFLOW",
        }),
      ).toThrow(/SKU collision/);
    });

    it("returns issue with code SKU_COLLISION_RESOLVED for APPEND_SOURCE_SUFFIX", () => {
      const ctx = createContext("APPEND_SOURCE_SUFFIX");
      const result = resolveSku(ctx, "WIDGET", "ext-widget-new", {
        externalId: "ext-widget-old",
        externalSource: "INFLOW",
      });

      expect(result.issue?.code).toBe("SKU_COLLISION_RESOLVED");
      expect(result.issue?.message).toContain("WIDGET-SRT");
    });
  });
});
