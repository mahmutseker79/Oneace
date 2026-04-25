// Sprint 9 PR #3 — plural helper unit pin
// (UX/UI audit Apr-25 §B-plural follow-up).

import { describe, expect, it } from "vitest";
import { formatCount, pluralWordEn, pluralizeEn } from "./plural";

describe("Sprint 9 PR #3 §B-plural — plural helpers", () => {
  describe("pluralizeEn", () => {
    it("returns singular form for count = 1", () => {
      expect(pluralizeEn(1, "item")).toBe("1 item");
    });

    it("returns plural form (default +s) for count = 0", () => {
      expect(pluralizeEn(0, "item")).toBe("0 items");
    });

    it("returns plural form for count > 1", () => {
      expect(pluralizeEn(12, "item")).toBe("12 items");
    });

    it("supports irregular plurals (boxes)", () => {
      expect(pluralizeEn(3, "box", "boxes")).toBe("3 boxes");
      expect(pluralizeEn(1, "box", "boxes")).toBe("1 box");
    });

    it("supports y → ies (categories)", () => {
      expect(pluralizeEn(2, "category", "categories")).toBe("2 categories");
      expect(pluralizeEn(1, "category", "categories")).toBe("1 category");
    });
  });

  describe("pluralWordEn", () => {
    it("returns word only — no count", () => {
      expect(pluralWordEn(1, "result")).toBe("result");
      expect(pluralWordEn(5, "result")).toBe("results");
    });

    it("supports irregular plural", () => {
      expect(pluralWordEn(1, "warehouse")).toBe("warehouse");
      expect(pluralWordEn(3, "warehouse")).toBe("warehouses");
    });
  });

  describe("formatCount (locale-aware)", () => {
    it("EN locale uses pluralizeEn", () => {
      expect(formatCount("en", 5, { singular: "item" })).toBe("5 items");
      expect(formatCount("en", 1, { singular: "item" })).toBe("1 item");
    });

    it("TR locale uses singular always (no plural agreement)", () => {
      expect(formatCount("tr", 5, { singular: "item", tr: "ürün" })).toBe("5 ürün");
      expect(formatCount("tr", 1, { singular: "item", tr: "ürün" })).toBe("1 ürün");
      expect(formatCount("tr", 12, { singular: "item", tr: "ürün" })).toBe("12 ürün");
    });

    it("TR locale falls back to EN singular if tr field is omitted", () => {
      expect(formatCount("tr", 3, { singular: "item" })).toBe("3 item");
    });
  });
});
