// P9.2 — regression tests for stock count validation schemas.
//
// Covers: addEntryInputSchema with and without binId, the optionalId
// transform on binId, createCountInputSchema constraints, and the
// countEntryOpPayloadSchema wrapper.

import { describe, expect, it } from "vitest";

import {
  addEntryInputSchema,
  countEntryOpPayloadSchema,
  createCountInputSchema,
} from "./stockcount";

// ---------------------------------------------------------------------------
// addEntryInputSchema
// ---------------------------------------------------------------------------

describe("addEntryInputSchema", () => {
  const base = {
    countId: "count-1",
    itemId: "item-1",
    warehouseId: "wh-1",
    countedQuantity: 10,
  };

  it("accepts a valid entry without binId (warehouse-level)", () => {
    const result = addEntryInputSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.binId).toBeNull();
      expect(result.data.counterTag).toBeNull();
      expect(result.data.note).toBeNull();
    }
  });

  it("accepts a valid entry with binId (bin-level)", () => {
    const result = addEntryInputSchema.safeParse({ ...base, binId: "bin-A1" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.binId).toBe("bin-A1");
    }
  });

  it("transforms empty string binId to null", () => {
    const result = addEntryInputSchema.safeParse({ ...base, binId: "" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.binId).toBeNull();
    }
  });

  it("transforms undefined binId to null", () => {
    const result = addEntryInputSchema.safeParse({ ...base, binId: undefined });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.binId).toBeNull();
    }
  });

  it("accepts counted quantity of 0 (empty bin)", () => {
    const result = addEntryInputSchema.safeParse({ ...base, countedQuantity: 0 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.countedQuantity).toBe(0);
    }
  });

  it("rejects negative counted quantity", () => {
    const result = addEntryInputSchema.safeParse({ ...base, countedQuantity: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects missing countId", () => {
    const { countId: _, ...noCid } = base;
    const result = addEntryInputSchema.safeParse(noCid);
    expect(result.success).toBe(false);
  });

  it("rejects missing itemId", () => {
    const result = addEntryInputSchema.safeParse({ ...base, itemId: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing warehouseId", () => {
    const result = addEntryInputSchema.safeParse({ ...base, warehouseId: "" });
    expect(result.success).toBe(false);
  });

  it("accepts a string quantity and truncates to integer", () => {
    const result = addEntryInputSchema.safeParse({ ...base, countedQuantity: "7.9" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.countedQuantity).toBe(7);
    }
  });

  it("trims note whitespace and transforms empty to null", () => {
    const result = addEntryInputSchema.safeParse({ ...base, note: "   " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.note).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// createCountInputSchema
// ---------------------------------------------------------------------------

describe("createCountInputSchema", () => {
  const valid = {
    name: "Q2 Cycle Count",
    methodology: "CYCLE" as const,
    itemIds: ["item-1", "item-2"],
  };

  it("accepts a valid count without warehouseId", () => {
    const result = createCountInputSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.warehouseId).toBeNull();
    }
  });

  it("accepts a valid count with warehouseId", () => {
    const result = createCountInputSchema.safeParse({ ...valid, warehouseId: "wh-1" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.warehouseId).toBe("wh-1");
    }
  });

  it("rejects empty name", () => {
    const result = createCountInputSchema.safeParse({ ...valid, name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects empty itemIds array", () => {
    const result = createCountInputSchema.safeParse({ ...valid, itemIds: [] });
    expect(result.success).toBe(false);
  });

  it("rejects invalid methodology", () => {
    const result = createCountInputSchema.safeParse({ ...valid, methodology: "RANDOM" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// countEntryOpPayloadSchema
// ---------------------------------------------------------------------------

describe("countEntryOpPayloadSchema", () => {
  const validInput = {
    countId: "count-1",
    itemId: "item-1",
    warehouseId: "wh-1",
    binId: "bin-1",
    countedQuantity: 5,
  };

  it("accepts a valid payload with UUID idempotency key", () => {
    const result = countEntryOpPayloadSchema.safeParse({
      idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
      input: validInput,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-UUID idempotency key", () => {
    const result = countEntryOpPayloadSchema.safeParse({
      idempotencyKey: "not-a-uuid",
      input: validInput,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing idempotency key", () => {
    const result = countEntryOpPayloadSchema.safeParse({ input: validInput });
    expect(result.success).toBe(false);
  });
});
