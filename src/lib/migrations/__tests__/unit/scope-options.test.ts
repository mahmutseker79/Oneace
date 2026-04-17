import {
  defaultScopeOptions,
  parseScopeOptions,
  resolvePoHistoryCutoff,
  shouldImportPurchaseOrders,
  tryParseScopeOptions,
} from "@/lib/migrations/core/scope-options";
import { describe, expect, it } from "vitest";

describe("scope-options", () => {
  describe("defaultScopeOptions", () => {
    it("returns default scope with LAST_12_MONTHS, includeCustomFields=true, includeAttachments=true, includeArchivedItems=false", () => {
      const defaults = defaultScopeOptions();
      expect(defaults.poHistory).toBe("LAST_12_MONTHS");
      expect(defaults.includeCustomFields).toBe(true);
      expect(defaults.includeAttachments).toBe(true);
      expect(defaults.includeArchivedItems).toBe(false);
    });
  });

  describe("parseScopeOptions", () => {
    it("parses valid JSON object and returns MigrationScopeOptions", () => {
      const opts = parseScopeOptions({
        poHistory: "ALL",
        includeCustomFields: false,
      });
      expect(opts.poHistory).toBe("ALL");
      expect(opts.includeCustomFields).toBe(false);
      expect(opts.includeAttachments).toBe(true); // default
    });

    it("throws on malformed JSON with invalid enum value", () => {
      expect(() =>
        parseScopeOptions({
          poHistory: "INVALID_SCOPE",
        }),
      ).toThrow();
    });

    it("throws on non-strict extra properties", () => {
      expect(() =>
        parseScopeOptions({
          poHistory: "LAST_12_MONTHS",
          extraField: true,
        }),
      ).toThrow();
    });
  });

  describe("tryParseScopeOptions", () => {
    it("returns parsed object for valid JSON", () => {
      const opts = tryParseScopeOptions({
        poHistory: "OPEN_ONLY",
        includeArchivedItems: true,
      });
      expect(opts).not.toBeNull();
      expect(opts?.poHistory).toBe("OPEN_ONLY");
      expect(opts?.includeArchivedItems).toBe(true);
    });

    it("returns null for invalid JSON without throwing", () => {
      const result = tryParseScopeOptions({ poHistory: "GARBAGE" });
      expect(result).toBeNull();
    });

    it("returns null for non-object input", () => {
      expect(tryParseScopeOptions("not an object")).toBeNull();
      expect(tryParseScopeOptions(null)).toBeNull();
      expect(tryParseScopeOptions(undefined)).toBeNull();
    });
  });

  describe("resolvePoHistoryCutoff", () => {
    it("returns now - 365 days for LAST_12_MONTHS scope", () => {
      const now = new Date("2025-04-17T12:00:00Z");
      const cutoff = resolvePoHistoryCutoff("LAST_12_MONTHS", now);
      expect(cutoff).not.toBeNull();
      // Check date is approximately 365 days before now
      const expectedCutoff = new Date(now);
      expectedCutoff.setUTCDate(expectedCutoff.getUTCDate() - 365);
      expect(cutoff?.toISOString()).toBe(expectedCutoff.toISOString());
    });

    it("returns null for ALL scope", () => {
      const cutoff = resolvePoHistoryCutoff("ALL");
      expect(cutoff).toBeNull();
    });

    it("returns null for OPEN_ONLY scope", () => {
      const cutoff = resolvePoHistoryCutoff("OPEN_ONLY");
      expect(cutoff).toBeNull();
    });

    it("returns null for SKIP scope", () => {
      const cutoff = resolvePoHistoryCutoff("SKIP");
      expect(cutoff).toBeNull();
    });

    it("uses current date if not provided", () => {
      const cutoff = resolvePoHistoryCutoff("LAST_12_MONTHS");
      expect(cutoff).not.toBeNull();
      const now = new Date();
      const diff = now.getTime() - cutoff?.getTime();
      // Should be approximately 365 days (±1 day for rounding)
      const expectedMs = 365 * 24 * 60 * 60 * 1000;
      expect(Math.abs(diff - expectedMs)).toBeLessThan(2 * 24 * 60 * 60 * 1000);
    });
  });

  describe("shouldImportPurchaseOrders", () => {
    it("returns false when poHistory is SKIP", () => {
      const opts = {
        poHistory: "SKIP" as const,
        includeCustomFields: true,
        includeAttachments: true,
        includeArchivedItems: false,
      };
      expect(shouldImportPurchaseOrders(opts)).toBe(false);
    });

    it("returns true for LAST_12_MONTHS", () => {
      const opts = defaultScopeOptions();
      expect(shouldImportPurchaseOrders(opts)).toBe(true);
    });

    it("returns true for ALL", () => {
      const opts = {
        poHistory: "ALL" as const,
        includeCustomFields: true,
        includeAttachments: true,
        includeArchivedItems: false,
      };
      expect(shouldImportPurchaseOrders(opts)).toBe(true);
    });

    it("returns true for OPEN_ONLY", () => {
      const opts = {
        poHistory: "OPEN_ONLY" as const,
        includeCustomFields: true,
        includeAttachments: true,
        includeArchivedItems: false,
      };
      expect(shouldImportPurchaseOrders(opts)).toBe(true);
    });
  });
});
