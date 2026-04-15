// Pure-function tests for the shared utility helpers.

import { describe, expect, it } from "vitest";

import { formatCurrency, formatNumber, slugify } from "./utils";

describe("slugify", () => {
  it("lowercases and replaces spaces with hyphens", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("strips diacritics and folds to ASCII", () => {
    expect(slugify("Ürün Adı")).toBe("urun-ad"); // dotless-ı (U+0131) does not decompose via NFKD
    expect(slugify("Café au lait")).toBe("cafe-au-lait");
    expect(slugify("Naïve résumé")).toBe("naive-resume");
    expect(slugify("Müller")).toBe("muller");
  });

  it("removes leading and trailing hyphens", () => {
    expect(slugify("  hello  ")).toBe("hello");
    expect(slugify("!hello!")).toBe("hello");
  });

  it("collapses multiple non-alphanumeric sequences into one hyphen", () => {
    expect(slugify("a -- b")).toBe("a-b");
    expect(slugify("foo   bar")).toBe("foo-bar");
  });

  it("preserves digits", () => {
    expect(slugify("Item 42")).toBe("item-42");
    expect(slugify("2024-Q1 Report")).toBe("2024-q1-report");
  });

  it("handles empty string", () => {
    expect(slugify("")).toBe("");
  });
});

describe("formatCurrency", () => {
  it("formats USD with two decimal places by default", () => {
    const result = formatCurrency(1234.5, { currency: "USD", locale: "en-US" });
    expect(result).toContain("1,234.50");
    expect(result).toContain("$");
  });

  it("formats EUR in a German locale", () => {
    const result = formatCurrency(1000, { currency: "EUR", locale: "de-DE" });
    expect(result).toContain("1.000");
    expect(result).toContain("€");
  });

  it("handles zero correctly", () => {
    const result = formatCurrency(0, { currency: "USD", locale: "en-US" });
    expect(result).toContain("0.00");
  });

  it("uses USD / en-US as defaults when options are omitted", () => {
    const result = formatCurrency(99.9);
    expect(result).toContain("$");
    expect(result).toContain("99.90");
  });
});

describe("formatNumber", () => {
  it("formats integers with locale separators", () => {
    const result = formatNumber(1234567, "en-US");
    expect(result).toBe("1,234,567");
  });

  it("formats zero", () => {
    expect(formatNumber(0)).toBe("0");
  });

  it("uses en-US locale by default", () => {
    const result = formatNumber(1000);
    expect(result).toBe("1,000");
  });
});
