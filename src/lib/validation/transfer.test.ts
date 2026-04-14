// Phase 11.1 — Transfer wizard validation tests.
//
// Tests the server-side validation schema (`createTransferInputSchema`)
// and the action-level shape contract for multi-line transfers.
// No database calls — pure schema behaviour.

import { describe, expect, it } from "vitest";

import { createTransferInputSchema, transferLineSchema } from "./transfer";

// ---------------------------------------------------------------------------
// transferLineSchema
// ---------------------------------------------------------------------------

describe("transferLineSchema", () => {
  it("accepts a valid line", () => {
    const result = transferLineSchema.safeParse({ itemId: "item-1", quantity: 5 });
    expect(result.success).toBe(true);
  });

  it("rejects quantity of 0", () => {
    const result = transferLineSchema.safeParse({ itemId: "item-1", quantity: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects negative quantity", () => {
    const result = transferLineSchema.safeParse({ itemId: "item-1", quantity: -3 });
    expect(result.success).toBe(false);
  });

  it("rejects missing itemId", () => {
    const result = transferLineSchema.safeParse({ itemId: "", quantity: 5 });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer quantity", () => {
    const result = transferLineSchema.safeParse({ itemId: "item-1", quantity: 1.5 });
    expect(result.success).toBe(false);
  });

  it("rejects quantity exceeding max", () => {
    const result = transferLineSchema.safeParse({
      itemId: "item-1",
      quantity: 1_000_001,
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createTransferInputSchema — field-level validation
// ---------------------------------------------------------------------------

const validBase = {
  fromWarehouseId: "wh-a",
  toWarehouseId: "wh-b",
  lines: [{ itemId: "item-1", quantity: 10 }],
};

describe("createTransferInputSchema — valid input", () => {
  it("accepts minimal valid input", () => {
    const result = createTransferInputSchema.safeParse(validBase);
    expect(result.success).toBe(true);
  });

  it("accepts multiple lines", () => {
    const result = createTransferInputSchema.safeParse({
      ...validBase,
      lines: [
        { itemId: "item-1", quantity: 5 },
        { itemId: "item-2", quantity: 3 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts optional reference and note", () => {
    const result = createTransferInputSchema.safeParse({
      ...validBase,
      reference: "REF-001",
      note: "Restock warehouse B",
    });
    expect(result.success).toBe(true);
  });

  it("coerces empty reference to null", () => {
    const result = createTransferInputSchema.safeParse({
      ...validBase,
      reference: "",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reference).toBeNull();
    }
  });

  it("coerces whitespace-only note to null", () => {
    const result = createTransferInputSchema.safeParse({
      ...validBase,
      note: "  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.note).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// createTransferInputSchema — cross-field rules
// ---------------------------------------------------------------------------

describe("createTransferInputSchema — same-warehouse rejection", () => {
  it("rejects same source and destination", () => {
    const result = createTransferInputSchema.safeParse({
      ...validBase,
      fromWarehouseId: "wh-a",
      toWarehouseId: "wh-a",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("toWarehouseId");
    }
  });
});

describe("createTransferInputSchema — empty lines rejection", () => {
  it("rejects empty lines array", () => {
    const result = createTransferInputSchema.safeParse({
      ...validBase,
      lines: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("createTransferInputSchema — duplicate items", () => {
  it("rejects duplicate itemIds in lines", () => {
    const result = createTransferInputSchema.safeParse({
      ...validBase,
      lines: [
        { itemId: "item-1", quantity: 5 },
        { itemId: "item-1", quantity: 3 },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msgs = result.error.issues.map((i) => i.message);
      expect(msgs.some((m) => m.includes("more than once"))).toBe(true);
    }
  });
});

describe("createTransferInputSchema — invalid warehouse IDs", () => {
  it("rejects empty fromWarehouseId", () => {
    const result = createTransferInputSchema.safeParse({
      ...validBase,
      fromWarehouseId: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty toWarehouseId", () => {
    const result = createTransferInputSchema.safeParse({
      ...validBase,
      toWarehouseId: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("createTransferInputSchema — line-level quantity validation", () => {
  it("rejects line with zero quantity", () => {
    const result = createTransferInputSchema.safeParse({
      ...validBase,
      lines: [{ itemId: "item-1", quantity: 0 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects line with negative quantity", () => {
    const result = createTransferInputSchema.safeParse({
      ...validBase,
      lines: [{ itemId: "item-1", quantity: -1 }],
    });
    expect(result.success).toBe(false);
  });
});

describe("createTransferInputSchema — reference length", () => {
  it("rejects reference longer than 120 chars", () => {
    const result = createTransferInputSchema.safeParse({
      ...validBase,
      reference: "a".repeat(121),
    });
    expect(result.success).toBe(false);
  });

  it("accepts reference of exactly 120 chars", () => {
    const result = createTransferInputSchema.safeParse({
      ...validBase,
      reference: "a".repeat(120),
    });
    expect(result.success).toBe(true);
  });
});
