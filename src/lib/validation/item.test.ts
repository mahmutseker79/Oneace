// Phase 6B / Item 2 — pure-function tests for the item input schema.
//
// Scope: a tiny happy-path + three targeted rejection cases that pin
// down the parts of the schema most likely to regress silently: SKU
// character class, currency uppercase, and the non-negative money
// refinement. No database, no form-layer behaviour, no i18n — just
// the zod schema's input/output contract.

import { describe, expect, it } from "vitest";

import { itemInputSchema } from "./item";

describe("itemInputSchema", () => {
  it("accepts a minimal valid row and fills in defaults", () => {
    const result = itemInputSchema.safeParse({
      sku: "ABC-001",
      name: "Widget",
      reorderPoint: 0,
      reorderQty: 0,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sku).toBe("ABC-001");
      expect(result.data.unit).toBe("each");
      expect(result.data.currency).toBe("USD");
      expect(result.data.status).toBe("ACTIVE");
      expect(result.data.costPrice).toBeNull();
      expect(result.data.salePrice).toBeNull();
    }
  });

  it("rejects an SKU containing illegal characters", () => {
    const result = itemInputSchema.safeParse({
      sku: "bad sku!",
      name: "Widget",
      reorderPoint: 0,
      reorderQty: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a negative cost price", () => {
    const result = itemInputSchema.safeParse({
      sku: "ABC-002",
      name: "Widget",
      reorderPoint: 0,
      reorderQty: 0,
      costPrice: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a lowercase currency code", () => {
    const result = itemInputSchema.safeParse({
      sku: "ABC-003",
      name: "Widget",
      currency: "usd",
      reorderPoint: 0,
      reorderQty: 0,
    });
    expect(result.success).toBe(false);
  });
});
