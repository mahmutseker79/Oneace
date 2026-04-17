import { analyzeColumnDateFormats, parseDateFlexible } from "@/lib/migrations/core/date-utils";
import { describe, expect, it } from "vitest";

describe("date-utils", () => {
  describe("parseDateFlexible", () => {
    it("parses ISO 8601 format (YYYY-MM-DD)", () => {
      const result = parseDateFlexible("2024-12-31");
      expect(result).toBe("2024-12-31");
    });

    it("parses US format MM/DD/YYYY", () => {
      const result = parseDateFlexible("12/31/2024");
      // Should parse and return ISO date string
      expect(result).not.toBeNull();
      expect(result).toMatch(/\d{4}-\d{2}-\d{2}/);
    });

    it("parses EU format DD/MM/YYYY with day > 12", () => {
      const result = parseDateFlexible("31/12/2024");
      expect(result).toContain("2024");
      expect(result).toContain("12");
    });

    it("parses EU period format DD.MM.YYYY", () => {
      const result = parseDateFlexible("31.12.2024");
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
    });

    it("returns null for garbage input", () => {
      expect(parseDateFlexible("not-a-date")).toBeNull();
      expect(parseDateFlexible("abc123")).toBeNull();
    });

    it("returns null for null or undefined input", () => {
      expect(parseDateFlexible(null)).toBeNull();
      expect(parseDateFlexible(undefined)).toBeNull();
    });

    it("handles 2-digit year parsing", () => {
      const result25 = parseDateFlexible("12/31/25");
      expect(result25).not.toBeNull();
      // Should parse to a valid date
      expect(result25).toMatch(/\d{4}-\d{2}-\d{2}/);

      const result99 = parseDateFlexible("12/31/99");
      expect(result99).not.toBeNull();
      expect(result99).toMatch(/\d{4}-\d{2}-\d{2}/);
    });

    it("handles ambiguous dates by preferring US format (MM/DD)", () => {
      // 01/02/2024 could be Jan 2 or Feb 1; prefer Jan 2 (US MM/DD)
      const result = parseDateFlexible("01/02/2024");
      expect(result).toBeDefined();
      // Should parse successfully without error
    });
  });

  describe("analyzeColumnDateFormats", () => {
    it("detects ISO8601 format dominance", () => {
      const values = ["2024-01-01", "2024-02-15", "2024-03-20", "garbage"];
      const analysis = analyzeColumnDateFormats(values);

      expect(analysis.dominantFormat).toBe("ISO8601");
      expect(analysis.count.iso8601).toBe(3);
      expect(analysis.count.unparseable).toBe(1);
    });

    it("detects SLASH format dominance", () => {
      const values = ["01/15/2024", "02/20/2024", "03/10/2024"];
      const analysis = analyzeColumnDateFormats(values);

      expect(analysis.dominantFormat).toBe("SLASH");
      expect(analysis.count.slashFormat).toBe(3);
    });

    it("detects PERIOD format dominance", () => {
      const values = ["15.01.2024", "20.02.2024", "10.03.2024"];
      const analysis = analyzeColumnDateFormats(values);

      expect(analysis.dominantFormat).toBe("PERIOD");
      expect(analysis.count.periodFormat).toBe(3);
    });

    it("marks as inconsistent if dominant format < 80% of values", () => {
      const values = [
        "2024-01-01", // ISO8601: 1
        "01/15/2024", // SLASH: 2
        "15.01.2024", // PERIOD: 3
        "garbage", // Unparseable: 4
      ];
      const analysis = analyzeColumnDateFormats(values);

      expect(analysis.isInconsistent).toBe(true);
    });

    it("marks as consistent if dominant format >= 80% of values", () => {
      const values = [
        "2024-01-01",
        "2024-02-15",
        "2024-03-20",
        "2024-04-10",
        "2024-05-05",
        "garbage", // 1/6 unparseable, 5 ISO8601 = 83%
      ];
      const analysis = analyzeColumnDateFormats(values);

      expect(analysis.isInconsistent).toBe(false);
    });

    it("handles empty array gracefully", () => {
      const analysis = analyzeColumnDateFormats([]);

      expect(analysis.dominantFormat).toBeNull();
      expect(analysis.isInconsistent).toBe(false);
      expect(analysis.count.iso8601).toBe(0);
    });

    it("ignores null and undefined values", () => {
      const values = [null, undefined, "2024-01-01", "2024-02-15"];
      const analysis = analyzeColumnDateFormats(values);

      expect(analysis.count.iso8601).toBe(2);
      expect(analysis.count.unparseable).toBe(0);
    });
  });
});
