// src/lib/validation/kit.test.ts
//
// GOD MODE roadmap 2026-04-23 — P1-03 test coverage ratchet.
//
// Zod-schema coverage for kit create / add-component / assemble /
// disassemble. Pure schema → 100% achievable from this file alone.

import { describe, expect, it } from "vitest";

import {
  addKitComponentSchema,
  assembleKitSchema,
  createKitSchema,
  disassembleKitSchema,
  kitTypeEnum,
} from "./kit";

describe("kitTypeEnum", () => {
  it("accepts BUNDLE / KIT / ASSEMBLY", () => {
    expect(kitTypeEnum.parse("BUNDLE")).toBe("BUNDLE");
    expect(kitTypeEnum.parse("KIT")).toBe("KIT");
    expect(kitTypeEnum.parse("ASSEMBLY")).toBe("ASSEMBLY");
  });
  it("rejects unknown values", () => {
    expect(() => kitTypeEnum.parse("OTHER")).toThrow();
  });
});

describe("createKitSchema", () => {
  const base = { parentItemId: "item_1", name: "Toy Kit" };

  it("accepts a minimal valid payload", () => {
    const parsed = createKitSchema.safeParse(base);
    expect(parsed.success).toBe(true);
  });

  it("rejects empty parentItemId", () => {
    const r = createKitSchema.safeParse({ ...base, parentItemId: "" });
    expect(r.success).toBe(false);
  });

  it("rejects blank name (after trim)", () => {
    const r = createKitSchema.safeParse({ ...base, name: "   " });
    expect(r.success).toBe(false);
  });

  it("rejects name longer than 255", () => {
    const r = createKitSchema.safeParse({ ...base, name: "x".repeat(256) });
    expect(r.success).toBe(false);
  });

  it("accepts a description up to 2000 chars", () => {
    const r = createKitSchema.safeParse({ ...base, description: "y".repeat(2000) });
    expect(r.success).toBe(true);
  });

  it("rejects a description over 2000 chars", () => {
    const r = createKitSchema.safeParse({ ...base, description: "y".repeat(2001) });
    expect(r.success).toBe(false);
  });
});

describe("addKitComponentSchema", () => {
  const base = { kitId: "k_1", componentItemId: "i_1", quantity: 3 };

  it("accepts minimal", () => {
    const r = addKitComponentSchema.safeParse(base);
    expect(r.success).toBe(true);
  });

  it("coerces string quantity to integer", () => {
    const r = addKitComponentSchema.safeParse({ ...base, quantity: "7" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.quantity).toBe(7);
  });

  it("rejects zero / negative qty", () => {
    expect(addKitComponentSchema.safeParse({ ...base, quantity: 0 }).success).toBe(false);
    expect(addKitComponentSchema.safeParse({ ...base, quantity: -1 }).success).toBe(false);
  });

  it("truncates non-integer qty (Math.trunc — schema's documented coercion)", () => {
    // The schema applies Math.trunc inside its transform so 1.5 → 1
    // rather than being rejected outright. That is intentional
    // (tolerant of UI <input type="number" step="0.01"> slips);
    // this test pins the behaviour so a future stricter schema
    // has to update the test alongside the code.
    const r = addKitComponentSchema.safeParse({ ...base, quantity: 1.5 });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.quantity).toBe(1);
  });

  it("rejects truly non-finite qty (string that isn't a number)", () => {
    const r = addKitComponentSchema.safeParse({ ...base, quantity: "abc" });
    expect(r.success).toBe(false);
  });

  it("rejects qty over 1,000,000", () => {
    const r = addKitComponentSchema.safeParse({ ...base, quantity: 1_000_001 });
    expect(r.success).toBe(false);
  });

  it("variantId: empty / undefined / null all normalise to null", () => {
    for (const v of ["", undefined, null]) {
      const r = addKitComponentSchema.safeParse({ ...base, variantId: v });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.variantId).toBeNull();
    }
  });
});

describe("assembleKitSchema", () => {
  const base = { kitId: "k_1", warehouseId: "wh_1", quantity: 2 };

  it("accepts minimal", () => {
    expect(assembleKitSchema.safeParse(base).success).toBe(true);
  });

  it("rejects missing warehouseId", () => {
    const r = assembleKitSchema.safeParse({ ...base, warehouseId: "" });
    expect(r.success).toBe(false);
  });

  it("note normalises empty → null", () => {
    const r = assembleKitSchema.safeParse({ ...base, note: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.note).toBeNull();
  });

  it("note over 500 chars rejected", () => {
    const r = assembleKitSchema.safeParse({ ...base, note: "z".repeat(501) });
    expect(r.success).toBe(false);
  });
});

describe("disassembleKitSchema", () => {
  it("mirrors assemble shape", () => {
    const r = disassembleKitSchema.safeParse({
      kitId: "k_1",
      warehouseId: "wh_1",
      quantity: 1,
    });
    expect(r.success).toBe(true);
  });

  it("rejects non-finite qty input (NaN from string '')", () => {
    const r = disassembleKitSchema.safeParse({
      kitId: "k_1",
      warehouseId: "wh_1",
      quantity: "",
    });
    expect(r.success).toBe(false);
  });
});
