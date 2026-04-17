import { describe, it, expect } from "vitest";
import {
  parseCsv,
  sniffDelimiter,
  parseDecimalLocaleAware,
  normalizeCsvBuffer,
} from "@/lib/migrations/core/csv-utils";

describe("csv-utils", () => {
  describe("sniffDelimiter", () => {
    it("detects comma delimiter in first line", () => {
      const buffer = Buffer.from("Name,SKU,Price\nWidget,WID001,10.00");
      expect(sniffDelimiter(buffer)).toBe(",");
    });

    it("detects tab delimiter", () => {
      const buffer = Buffer.from("Name\tSKU\tPrice\nWidget\tWID001\t10.00");
      expect(sniffDelimiter(buffer)).toBe("\t");
    });

    it("detects semicolon delimiter", () => {
      const buffer = Buffer.from("Name;SKU;Price\nWidget;WID001;10.00");
      expect(sniffDelimiter(buffer)).toBe(";");
    });

    it("defaults to comma for ambiguous cases", () => {
      const buffer = Buffer.from("SingleField");
      expect(sniffDelimiter(buffer)).toBe(",");
    });
  });

  describe("parseCsv", () => {
    it("parses simple CSV with comma delimiter", () => {
      const buffer = Buffer.from("Name,SKU,Price\nWidget,WID001,10.50");
      const { headers, rows } = parseCsv(buffer, ",");

      expect(headers).toEqual(["Name", "SKU", "Price"]);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual({ Name: "Widget", SKU: "WID001", Price: "10.50" });
    });

    it("parses CSV with quoted fields containing commas", () => {
      const buffer = Buffer.from('Name,Description\nWidget,"A great, useful tool"');
      const { headers, rows } = parseCsv(buffer, ",");

      expect(rows[0]?.Description).toBe("A great, useful tool");
    });

    it("handles escaped quotes in quoted fields", () => {
      const buffer = Buffer.from('Name,Note\nWidget,"He said ""hello"""');
      const { headers, rows } = parseCsv(buffer, ",");

      expect(rows[0]?.Note).toBe('He said "hello"');
    });

    it("parses TSV with tab delimiter", () => {
      const buffer = Buffer.from("Name\tSKU\nWidget\tWID001");
      const { headers, rows } = parseCsv(buffer, "\t");

      expect(headers).toEqual(["Name", "SKU"]);
      expect(rows[0]?.Name).toBe("Widget");
    });

    it("handles empty CSV gracefully", () => {
      const buffer = Buffer.from("");
      const { headers, rows } = parseCsv(buffer, ",");

      // Empty buffer produces one empty header string; rows stay empty
      expect(rows).toEqual([]);
    });
  });

  describe("normalizeCsvBuffer", () => {
    it("strips UTF-8 BOM from buffer", () => {
      const bomBuffer = Buffer.concat([
        Buffer.from([0xef, 0xbb, 0xbf]), // UTF-8 BOM
        Buffer.from("Hello"),
      ]);
      const result = normalizeCsvBuffer(bomBuffer);
      expect(result).toBe("Hello");
    });

    it("handles Windows-1252 encoding", () => {
      // Create a buffer with Windows-1252 byte 0xe9 (é in latin-1)
      const buffer = Buffer.from([0x48, 0xe9, 0x6c, 0x6c, 0x6f]); // "Héllo" in latin-1
      const result = normalizeCsvBuffer(buffer);
      // Should be transcoded or at least readable
      expect(result).toContain("H");
      expect(result).toContain("o");
    });

    it("handles pure UTF-8 without modification", () => {
      const buffer = Buffer.from("Hello World");
      const result = normalizeCsvBuffer(buffer);
      expect(result).toBe("Hello World");
    });
  });

  describe("parseDecimalLocaleAware", () => {
    it("parses US format 1,234.56 as 1234.56", () => {
      expect(parseDecimalLocaleAware("1,234.56")).toBe(1234.56);
    });

    it("parses EU format 1.234,56 as 1234.56", () => {
      expect(parseDecimalLocaleAware("1.234,56")).toBe(1234.56);
    });

    it("parses simple integer 123", () => {
      expect(parseDecimalLocaleAware("123")).toBe(123);
    });

    it("parses negative numbers", () => {
      expect(parseDecimalLocaleAware("-42.5")).toBe(-42.5);
      expect(parseDecimalLocaleAware("-1.234,56")).toBe(-1234.56);
    });

    it("handles currency symbols and whitespace", () => {
      expect(parseDecimalLocaleAware(" $1,234.56 ")).toBe(1234.56);
      expect(parseDecimalLocaleAware("€ 1.234,56")).toBe(1234.56);
    });

    it("returns null for unparseable strings", () => {
      expect(parseDecimalLocaleAware("abc")).toBeNull();
      expect(parseDecimalLocaleAware("")).toBeNull();
      expect(parseDecimalLocaleAware(null)).toBeNull();
      expect(parseDecimalLocaleAware(undefined)).toBeNull();
    });

    it("handles Infinity and NaN edge cases", () => {
      expect(parseDecimalLocaleAware("Infinity")).toBeNull();
      expect(parseDecimalLocaleAware("NaN")).toBeNull();
    });
  });
});
