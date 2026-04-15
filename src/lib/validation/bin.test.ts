// Tests for the bin code validation schema.

import { describe, expect, it } from "vitest";

import { binInputSchema } from "./bin";

describe("binInputSchema", () => {
  describe("code field", () => {
    it("accepts valid alphanumeric codes", () => {
      const result = binInputSchema.safeParse({ code: "A1" });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.code).toBe("A1");
    });

    it("uppercases the code on transform", () => {
      const result = binInputSchema.safeParse({ code: "a1-shelf" });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.code).toBe("A1-SHELF");
    });

    it("accepts codes with allowed special chars: - _ . /", () => {
      const cases = ["A-1", "A_1", "A.1", "A/1", "ROW-1/SHELF.A_01"];
      for (const code of cases) {
        const result = binInputSchema.safeParse({ code });
        expect(result.success, `Expected '${code}' to be valid`).toBe(true);
      }
    });

    it("rejects empty code", () => {
      const result = binInputSchema.safeParse({ code: "" });
      expect(result.success).toBe(false);
    });

    it("rejects codes over 32 characters", () => {
      const result = binInputSchema.safeParse({ code: "A".repeat(33) });
      expect(result.success).toBe(false);
    });

    it("rejects codes with spaces", () => {
      const result = binInputSchema.safeParse({ code: "A 1" });
      expect(result.success).toBe(false);
    });

    it("rejects codes with special characters like #, $, !", () => {
      for (const code of ["A#1", "A$1", "A!1", "A@1"]) {
        const result = binInputSchema.safeParse({ code });
        expect(result.success, `Expected '${code}' to be invalid`).toBe(false);
      }
    });

    it("trims whitespace before validation", () => {
      const result = binInputSchema.safeParse({ code: "  A1  " });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.code).toBe("A1");
    });
  });

  describe("label field", () => {
    it("accepts a label string", () => {
      const result = binInputSchema.safeParse({ code: "A1", label: "Shelf A" });
      expect(result.success).toBe(true);
    });

    it("accepts null label", () => {
      const result = binInputSchema.safeParse({ code: "A1", label: null });
      expect(result.success).toBe(true);
    });

    it("accepts undefined label (optional)", () => {
      const result = binInputSchema.safeParse({ code: "A1" });
      expect(result.success).toBe(true);
    });

    it("rejects labels over 80 characters", () => {
      const result = binInputSchema.safeParse({ code: "A1", label: "x".repeat(81) });
      expect(result.success).toBe(false);
    });
  });
});
