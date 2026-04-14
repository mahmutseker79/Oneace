// Phase 11.3 — Putaway validation tests.
//
// Tests the server-side validation schema (`putawayInputSchema`)
// for the putaway-to-bin flow. Pure schema — no db, no env dependency.

import { describe, expect, it } from "vitest";

import { putawayInputSchema, putawayLineSchema } from "./putaway";

// ---------------------------------------------------------------------------
// putawayLineSchema
// ---------------------------------------------------------------------------

describe("putawayLineSchema", () => {
  it("accepts a valid line", () => {
    const result = putawayLineSchema.safeParse({
      itemId: "item-1",
      toBinId: "bin-1",
      quantity: 5,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing itemId", () => {
    const result = putawayLineSchema.safeParse({ itemId: "", toBinId: "bin-1", quantity: 5 });
    expect(result.success).toBe(false);
  });

  it("rejects missing toBinId", () => {
    const result = putawayLineSchema.safeParse({ itemId: "item-1", toBinId: "", quantity: 5 });
    expect(result.success).toBe(false);
  });

  it("rejects quantity of 0", () => {
    const result = putawayLineSchema.safeParse({ itemId: "item-1", toBinId: "bin-1", quantity: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects negative quantity", () => {
    const result = putawayLineSchema.safeParse({
      itemId: "item-1",
      toBinId: "bin-1",
      quantity: -3,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer quantity", () => {
    const result = putawayLineSchema.safeParse({
      itemId: "item-1",
      toBinId: "bin-1",
      quantity: 2.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects quantity exceeding max", () => {
    const result = putawayLineSchema.safeParse({
      itemId: "item-1",
      toBinId: "bin-1",
      quantity: 1_000_001,
    });
    expect(result.success).toBe(false);
  });

  it("accepts quantity of 1", () => {
    const result = putawayLineSchema.safeParse({ itemId: "item-1", toBinId: "bin-1", quantity: 1 });
    expect(result.success).toBe(true);
  });

  it("accepts maximum quantity", () => {
    const result = putawayLineSchema.safeParse({
      itemId: "item-1",
      toBinId: "bin-1",
      quantity: 1_000_000,
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// putawayInputSchema — valid inputs
// ---------------------------------------------------------------------------

const validBase = {
  warehouseId: "wh-1",
  lines: [{ itemId: "item-1", toBinId: "bin-1", quantity: 5 }],
};

describe("putawayInputSchema — valid inputs", () => {
  it("accepts minimal valid input", () => {
    const result = putawayInputSchema.safeParse(validBase);
    expect(result.success).toBe(true);
  });

  it("accepts same item in different bins", () => {
    const result = putawayInputSchema.safeParse({
      ...validBase,
      lines: [
        { itemId: "item-1", toBinId: "bin-1", quantity: 5 },
        { itemId: "item-1", toBinId: "bin-2", quantity: 3 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts different items in the same bin", () => {
    const result = putawayInputSchema.safeParse({
      ...validBase,
      lines: [
        { itemId: "item-1", toBinId: "bin-1", quantity: 5 },
        { itemId: "item-2", toBinId: "bin-1", quantity: 3 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts multiple items across multiple bins", () => {
    const result = putawayInputSchema.safeParse({
      ...validBase,
      lines: [
        { itemId: "item-1", toBinId: "bin-1", quantity: 10 },
        { itemId: "item-1", toBinId: "bin-2", quantity: 5 },
        { itemId: "item-2", toBinId: "bin-3", quantity: 7 },
      ],
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// putawayInputSchema — invalid warehouse
// ---------------------------------------------------------------------------

describe("putawayInputSchema — warehouse validation", () => {
  it("rejects empty warehouseId", () => {
    const result = putawayInputSchema.safeParse({ ...validBase, warehouseId: "" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// putawayInputSchema — empty lines
// ---------------------------------------------------------------------------

describe("putawayInputSchema — empty lines", () => {
  it("rejects empty lines array", () => {
    const result = putawayInputSchema.safeParse({ ...validBase, lines: [] });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// putawayInputSchema — duplicate (item + bin) combinations
// ---------------------------------------------------------------------------

describe("putawayInputSchema — duplicate item+bin combinations", () => {
  it("rejects exact same itemId + toBinId pair", () => {
    const result = putawayInputSchema.safeParse({
      ...validBase,
      lines: [
        { itemId: "item-1", toBinId: "bin-1", quantity: 5 },
        { itemId: "item-1", toBinId: "bin-1", quantity: 3 },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msgs = result.error.issues.map((i) => i.message);
      expect(msgs.some((m) => m.includes("Duplicate"))).toBe(true);
    }
  });

  it("allows same item in different bins (not a duplicate)", () => {
    const result = putawayInputSchema.safeParse({
      ...validBase,
      lines: [
        { itemId: "item-1", toBinId: "bin-1", quantity: 5 },
        { itemId: "item-1", toBinId: "bin-2", quantity: 3 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("allows same bin for different items (not a duplicate)", () => {
    const result = putawayInputSchema.safeParse({
      ...validBase,
      lines: [
        { itemId: "item-1", toBinId: "bin-1", quantity: 5 },
        { itemId: "item-2", toBinId: "bin-1", quantity: 3 },
      ],
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// putawayInputSchema — line-level validation within full schema
// ---------------------------------------------------------------------------

describe("putawayInputSchema — line quantity validation", () => {
  it("rejects line with zero quantity within schema", () => {
    const result = putawayInputSchema.safeParse({
      ...validBase,
      lines: [{ itemId: "item-1", toBinId: "bin-1", quantity: 0 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects line with negative quantity within schema", () => {
    const result = putawayInputSchema.safeParse({
      ...validBase,
      lines: [{ itemId: "item-1", toBinId: "bin-1", quantity: -1 }],
    });
    expect(result.success).toBe(false);
  });
});
