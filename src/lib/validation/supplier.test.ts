// Tests for the supplier input validation schema.

import { describe, expect, it } from "vitest";

import { supplierInputSchema } from "./supplier";

describe("supplierInputSchema", () => {
  const VALID_BASE = { name: "Acme Corp" };

  it("accepts a minimal valid supplier (name only)", () => {
    const result = supplierInputSchema.safeParse(VALID_BASE);
    expect(result.success).toBe(true);
  });

  describe("name field", () => {
    it("rejects empty name", () => {
      expect(supplierInputSchema.safeParse({ name: "" }).success).toBe(false);
    });

    it("rejects name over 160 characters", () => {
      const result = supplierInputSchema.safeParse({ name: "x".repeat(161) });
      expect(result.success).toBe(false);
    });

    it("trims whitespace", () => {
      const result = supplierInputSchema.safeParse({ name: "  Acme  " });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.name).toBe("Acme");
    });
  });

  describe("code field", () => {
    it("uppercases the code", () => {
      const result = supplierInputSchema.safeParse({ ...VALID_BASE, code: "acme-01" });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.code).toBe("ACME-01");
    });

    it("normalizes empty string to null", () => {
      const result = supplierInputSchema.safeParse({ ...VALID_BASE, code: "" });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.code).toBeNull();
    });

    it("rejects codes with spaces or special chars (only A-Z 0-9 - _)", () => {
      const bad = ["A B", "A.B", "A/B", "A@B"];
      for (const code of bad) {
        expect(
          supplierInputSchema.safeParse({ ...VALID_BASE, code }).success,
          `Expected '${code}' to fail`,
        ).toBe(false);
      }
    });
  });

  describe("email field", () => {
    it("accepts a valid email", () => {
      const result = supplierInputSchema.safeParse({ ...VALID_BASE, email: "buy@acme.com" });
      expect(result.success).toBe(true);
    });

    it("rejects an invalid email", () => {
      const result = supplierInputSchema.safeParse({ ...VALID_BASE, email: "not-an-email" });
      expect(result.success).toBe(false);
    });

    it("normalizes empty string to null", () => {
      const result = supplierInputSchema.safeParse({ ...VALID_BASE, email: "" });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.email).toBeNull();
    });
  });

  describe("website field", () => {
    it("accepts a valid URL", () => {
      const result = supplierInputSchema.safeParse({ ...VALID_BASE, website: "https://acme.com" });
      expect(result.success).toBe(true);
    });

    it("rejects an invalid URL", () => {
      const result = supplierInputSchema.safeParse({ ...VALID_BASE, website: "not-a-url" });
      expect(result.success).toBe(false);
    });

    it("normalizes empty string to null", () => {
      const result = supplierInputSchema.safeParse({ ...VALID_BASE, website: "" });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.website).toBeNull();
    });
  });

  describe("isActive field", () => {
    it("defaults to true when omitted", () => {
      const result = supplierInputSchema.safeParse(VALID_BASE);
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.isActive).toBe(true);
    });

    it("accepts false", () => {
      const result = supplierInputSchema.safeParse({ ...VALID_BASE, isActive: false });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.isActive).toBe(false);
    });
  });
});
