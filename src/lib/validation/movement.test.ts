// P9.2 — regression tests for movement validation schemas.
//
// Covers: movementInputSchema discriminated union (all 5 types),
// BIN_TRANSFER-specific validation (same-bin rejection, required fields),
// signedSourceDelta for each type, and movementDirection.

import { describe, expect, it } from "vitest";

import {
  type MovementInput,
  movementDirection,
  movementInputSchema,
  signedSourceDelta,
} from "./movement";

// ---------------------------------------------------------------------------
// movementInputSchema — happy paths
// ---------------------------------------------------------------------------

describe("movementInputSchema", () => {
  const base = { itemId: "item-1", warehouseId: "wh-1", quantity: 10 };

  it("accepts RECEIPT", () => {
    const result = movementInputSchema.safeParse({ type: "RECEIPT", ...base });
    expect(result.success).toBe(true);
  });

  it("accepts ISSUE", () => {
    const result = movementInputSchema.safeParse({ type: "ISSUE", ...base });
    expect(result.success).toBe(true);
  });

  it("accepts ADJUSTMENT with direction +1", () => {
    const result = movementInputSchema.safeParse({
      type: "ADJUSTMENT",
      ...base,
      direction: 1,
    });
    expect(result.success).toBe(true);
  });

  it("accepts ADJUSTMENT with direction -1", () => {
    const result = movementInputSchema.safeParse({
      type: "ADJUSTMENT",
      ...base,
      direction: -1,
    });
    expect(result.success).toBe(true);
  });

  it("accepts TRANSFER with different warehouses", () => {
    const result = movementInputSchema.safeParse({
      type: "TRANSFER",
      ...base,
      toWarehouseId: "wh-2",
    });
    expect(result.success).toBe(true);
  });

  it("accepts BIN_TRANSFER with different bins", () => {
    const result = movementInputSchema.safeParse({
      type: "BIN_TRANSFER",
      ...base,
      binId: "bin-A",
      toBinId: "bin-B",
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// movementInputSchema — rejection paths
// ---------------------------------------------------------------------------

describe("movementInputSchema — rejections", () => {
  const base = { itemId: "item-1", warehouseId: "wh-1", quantity: 10 };

  it("rejects TRANSFER with same source and destination warehouse", () => {
    const result = movementInputSchema.safeParse({
      type: "TRANSFER",
      ...base,
      toWarehouseId: "wh-1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects BIN_TRANSFER with same source and destination bin", () => {
    const result = movementInputSchema.safeParse({
      type: "BIN_TRANSFER",
      ...base,
      binId: "bin-A",
      toBinId: "bin-A",
    });
    expect(result.success).toBe(false);
  });

  it("rejects BIN_TRANSFER without binId", () => {
    const result = movementInputSchema.safeParse({
      type: "BIN_TRANSFER",
      ...base,
      toBinId: "bin-B",
    });
    expect(result.success).toBe(false);
  });

  it("rejects BIN_TRANSFER without toBinId", () => {
    const result = movementInputSchema.safeParse({
      type: "BIN_TRANSFER",
      ...base,
      binId: "bin-A",
    });
    expect(result.success).toBe(false);
  });

  it("rejects quantity of 0", () => {
    const result = movementInputSchema.safeParse({ type: "RECEIPT", ...base, quantity: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects negative quantity", () => {
    const result = movementInputSchema.safeParse({ type: "RECEIPT", ...base, quantity: -5 });
    expect(result.success).toBe(false);
  });

  it("rejects missing itemId", () => {
    const result = movementInputSchema.safeParse({
      type: "RECEIPT",
      warehouseId: "wh-1",
      quantity: 10,
      itemId: "",
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// signedSourceDelta
// ---------------------------------------------------------------------------

describe("signedSourceDelta", () => {
  it("RECEIPT → positive", () => {
    expect(
      signedSourceDelta({
        type: "RECEIPT",
        itemId: "i",
        warehouseId: "w",
        quantity: 5,
      } as MovementInput),
    ).toBe(5);
  });

  it("ISSUE → negative", () => {
    expect(
      signedSourceDelta({
        type: "ISSUE",
        itemId: "i",
        warehouseId: "w",
        quantity: 3,
      } as MovementInput),
    ).toBe(-3);
  });

  it("ADJUSTMENT +1 → positive", () => {
    expect(
      signedSourceDelta({
        type: "ADJUSTMENT",
        itemId: "i",
        warehouseId: "w",
        quantity: 7,
        direction: 1,
      } as MovementInput),
    ).toBe(7);
  });

  it("ADJUSTMENT -1 → negative", () => {
    expect(
      signedSourceDelta({
        type: "ADJUSTMENT",
        itemId: "i",
        warehouseId: "w",
        quantity: 7,
        direction: -1,
      } as MovementInput),
    ).toBe(-7);
  });

  it("TRANSFER → negative (source side)", () => {
    expect(
      signedSourceDelta({
        type: "TRANSFER",
        itemId: "i",
        warehouseId: "w",
        quantity: 4,
        toWarehouseId: "w2",
      } as MovementInput),
    ).toBe(-4);
  });

  it("BIN_TRANSFER → negative (source side)", () => {
    expect(
      signedSourceDelta({
        type: "BIN_TRANSFER",
        itemId: "i",
        warehouseId: "w",
        quantity: 2,
        binId: "b1",
        toBinId: "b2",
      } as MovementInput),
    ).toBe(-2);
  });
});

// ---------------------------------------------------------------------------
// movementDirection
// ---------------------------------------------------------------------------

describe("movementDirection", () => {
  it("RECEIPT → +1", () => {
    expect(
      movementDirection({
        type: "RECEIPT",
        itemId: "i",
        warehouseId: "w",
        quantity: 1,
      } as MovementInput),
    ).toBe(1);
  });

  it("ISSUE → -1", () => {
    expect(
      movementDirection({
        type: "ISSUE",
        itemId: "i",
        warehouseId: "w",
        quantity: 1,
      } as MovementInput),
    ).toBe(-1);
  });

  it("ADJUSTMENT carries user-chosen direction", () => {
    expect(
      movementDirection({
        type: "ADJUSTMENT",
        itemId: "i",
        warehouseId: "w",
        quantity: 1,
        direction: -1,
      } as MovementInput),
    ).toBe(-1);
  });

  it("TRANSFER → +1", () => {
    expect(
      movementDirection({
        type: "TRANSFER",
        itemId: "i",
        warehouseId: "w",
        quantity: 1,
        toWarehouseId: "w2",
      } as MovementInput),
    ).toBe(1);
  });
});
