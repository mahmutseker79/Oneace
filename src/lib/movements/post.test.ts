// src/lib/movements/post.test.ts
//
// Unit test for the postMovement seam.
//
// This is a lightweight test — no Prisma, no database. We stub `tx`
// with an in-memory fake and verify:
//   - Invariants throw before any insert.
//   - The persistable projection drops unknown fields.
//   - The cost-posting hook runs after insert.
//   - `withHook` isolates overrides (no leakage between tests).

import { describe, expect, it, vi } from "vitest";

import { type TxClient, postMovement, withHook } from "./post";

/**
 * Build a fake TxClient whose `stockMovement.create` resolves to a
 * shaped StockMovement record. Captures calls so we can assert on
 * the data we pass to Prisma.
 */
function makeFakeTx() {
  const calls: Array<{ data: Record<string, unknown> }> = [];
  const tx: TxClient = {
    stockMovement: {
      // @ts-expect-error — we only stub the subset we use.
      create: async ({ data }: { data: Record<string, unknown> }) => {
        calls.push({ data });
        return {
          id: "mvmt_fake_1",
          organizationId: data.organizationId,
          itemId: data.itemId,
          warehouseId: data.warehouseId,
          binId: data.binId ?? null,
          toWarehouseId: data.toWarehouseId ?? null,
          toBinId: data.toBinId ?? null,
          type: data.type,
          quantity: data.quantity,
          direction: data.direction ?? 1,
          reference: data.reference ?? null,
          note: data.note ?? null,
          idempotencyKey: data.idempotencyKey ?? null,
          purchaseOrderLineId: data.purchaseOrderLineId ?? null,
          stockCountId: data.stockCountId ?? null,
          reasonCodeId: data.reasonCodeId ?? null,
          serialNumberId: data.serialNumberId ?? null,
          batchId: data.batchId ?? null,
          createdAt: new Date("2026-04-23T00:00:00.000Z"),
          createdByUserId: data.createdByUserId ?? null,
        };
      },
    } as unknown as TxClient["stockMovement"],
  };
  return { tx, calls };
}

const validInput = {
  organizationId: "org_1",
  itemId: "item_1",
  warehouseId: "wh_1",
  type: "RECEIPT" as const,
  quantity: 5,
};

describe("postMovement — invariants", () => {
  it("rejects empty organizationId", async () => {
    const { tx, calls } = makeFakeTx();
    await expect(postMovement(tx, { ...validInput, organizationId: "" })).rejects.toThrow(
      /organizationId is required/,
    );
    expect(calls).toHaveLength(0);
  });

  it("rejects whitespace-only organizationId", async () => {
    const { tx, calls } = makeFakeTx();
    await expect(postMovement(tx, { ...validInput, organizationId: "   " })).rejects.toThrow(
      /organizationId is required/,
    );
    expect(calls).toHaveLength(0);
  });

  it("rejects non-finite quantity", async () => {
    const { tx, calls } = makeFakeTx();
    await expect(postMovement(tx, { ...validInput, quantity: Number.NaN })).rejects.toThrow(
      /quantity must be a finite number/,
    );
    expect(calls).toHaveLength(0);
  });

  it("rejects negative quantity", async () => {
    const { tx, calls } = makeFakeTx();
    await expect(postMovement(tx, { ...validInput, quantity: -1 })).rejects.toThrow(
      /quantity must be >= 0/,
    );
    expect(calls).toHaveLength(0);
  });

  it("rejects reserved LEGACY:-prefixed idempotencyKey (P0-03 guard)", async () => {
    const { tx, calls } = makeFakeTx();
    await expect(
      postMovement(tx, { ...validInput, idempotencyKey: "LEGACY:mvmt_xx" }),
    ).rejects.toThrow(/reserved LEGACY:/);
    expect(calls).toHaveLength(0);
  });
});

describe("postMovement — persistence", () => {
  it("persists only known fields and drops unknown forward-compat fields", async () => {
    const { tx, calls } = makeFakeTx();
    await postMovement(tx, {
      ...validInput,
      reference: "PO:1001",
      purchaseOrderLineId: "pol_1",
      createdByUserId: "user_1",
      // deliberately typed-out unknown field (forward-compat placeholder)
      ...({ unitCostUsed: 42.5 } as Record<string, unknown>),
    });
    expect(calls).toHaveLength(1);
    const persisted = calls[0]?.data;
    expect(persisted.organizationId).toBe("org_1");
    expect(persisted.reference).toBe("PO:1001");
    expect(persisted.purchaseOrderLineId).toBe("pol_1");
    // Unknown field must be dropped before reaching Prisma.
    expect("unitCostUsed" in persisted).toBe(false);
  });

  it("omits undefined fields entirely (does not send null for unset optionals)", async () => {
    const { tx, calls } = makeFakeTx();
    await postMovement(tx, validInput);
    const persisted = calls[0]?.data;
    expect("binId" in persisted).toBe(false);
    expect("note" in persisted).toBe(false);
    expect("reference" in persisted).toBe(false);
  });

  it("preserves explicit nulls (caller intent to clear)", async () => {
    const { tx, calls } = makeFakeTx();
    await postMovement(tx, { ...validInput, reference: null });
    const persisted = calls[0]?.data;
    expect(persisted.reference).toBeNull();
  });
});

describe("postMovement — P0-03 idempotencyKey defaulting", () => {
  it("auto-generates an idempotencyKey when caller omits it", async () => {
    const { tx, calls } = makeFakeTx();
    await postMovement(tx, validInput);
    const persisted = calls[0]?.data as { idempotencyKey?: unknown };
    expect(typeof persisted.idempotencyKey).toBe("string");
    expect((persisted.idempotencyKey as string).length).toBeGreaterThan(0);
  });

  it("auto-generates when caller passes null explicitly", async () => {
    const { tx, calls } = makeFakeTx();
    await postMovement(tx, { ...validInput, idempotencyKey: null });
    const persisted = calls[0]?.data as { idempotencyKey?: unknown };
    expect(typeof persisted.idempotencyKey).toBe("string");
    expect((persisted.idempotencyKey as string).length).toBeGreaterThan(0);
  });

  it("auto-generates when caller passes empty string", async () => {
    const { tx, calls } = makeFakeTx();
    await postMovement(tx, { ...validInput, idempotencyKey: "" });
    const persisted = calls[0]?.data as { idempotencyKey?: unknown };
    expect(typeof persisted.idempotencyKey).toBe("string");
    expect((persisted.idempotencyKey as string).length).toBeGreaterThan(0);
  });

  it("preserves the caller's explicit key (e.g. webhook derivation)", async () => {
    const { tx, calls } = makeFakeTx();
    await postMovement(tx, {
      ...validInput,
      idempotencyKey: "wh:shopify:abc-123",
    });
    const persisted = calls[0]?.data as { idempotencyKey?: unknown };
    expect(persisted.idempotencyKey).toBe("wh:shopify:abc-123");
  });

  it("generates distinct keys across successive calls (no static default)", async () => {
    const { tx, calls } = makeFakeTx();
    await postMovement(tx, validInput);
    await postMovement(tx, validInput);
    const k1 = (calls[0]?.data as { idempotencyKey: string }).idempotencyKey;
    const k2 = (calls[1]?.data as { idempotencyKey: string }).idempotencyKey;
    expect(k1).not.toBe(k2);
  });
});

describe("postMovement — P0-04 landed-cost field pass-through", () => {
  it("forwards purchaseUnitCost + landedUnitCost when supplied", async () => {
    const { tx, calls } = makeFakeTx();
    await postMovement(tx, {
      ...validInput,
      purchaseUnitCost: 12.5,
      landedUnitCost: 14.375,
    });
    const persisted = calls[0]?.data as {
      purchaseUnitCost?: unknown;
      landedUnitCost?: unknown;
    };
    expect(persisted.purchaseUnitCost).toBe(12.5);
    expect(persisted.landedUnitCost).toBe(14.375);
  });

  it("accepts string values (Prisma.Decimal-serialised)", async () => {
    const { tx, calls } = makeFakeTx();
    await postMovement(tx, {
      ...validInput,
      purchaseUnitCost: "10.123456",
      landedUnitCost: "11.000000",
    });
    const persisted = calls[0]?.data as {
      purchaseUnitCost?: unknown;
      landedUnitCost?: unknown;
    };
    expect(persisted.purchaseUnitCost).toBe("10.123456");
    expect(persisted.landedUnitCost).toBe("11.000000");
  });

  it("omits cost fields when not supplied", async () => {
    const { tx, calls } = makeFakeTx();
    await postMovement(tx, validInput);
    const persisted = calls[0]?.data;
    expect("purchaseUnitCost" in persisted).toBe(false);
    expect("landedUnitCost" in persisted).toBe(false);
  });

  it("preserves explicit nulls (caller intent to clear the cost)", async () => {
    const { tx, calls } = makeFakeTx();
    await postMovement(tx, {
      ...validInput,
      purchaseUnitCost: null,
      landedUnitCost: null,
    });
    const persisted = calls[0]?.data as {
      purchaseUnitCost?: unknown;
      landedUnitCost?: unknown;
    };
    expect(persisted.purchaseUnitCost).toBeNull();
    expect(persisted.landedUnitCost).toBeNull();
  });
});

describe("postMovement — cost-posting hook", () => {
  it("runs the default no-op hook and returns the inserted row unchanged", async () => {
    const { tx } = makeFakeTx();
    const result = await postMovement(tx, validInput);
    expect(result.id).toBe("mvmt_fake_1");
    expect(result.type).toBe("RECEIPT");
  });

  it("runs a scoped hook via withHook()", async () => {
    const { tx } = makeFakeTx();
    const spy = vi.fn(async (_tx, mv) => mv);
    const result = await withHook({ onAfterInsert: spy }, () => postMovement(tx, validInput));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(result.id).toBe("mvmt_fake_1");
  });

  it("restores the previous hook even if the scoped call throws", async () => {
    const { tx } = makeFakeTx();
    const scopedSpy = vi.fn(async () => {
      throw new Error("hook boom");
    });
    await expect(
      withHook({ onAfterInsert: scopedSpy }, () => postMovement(tx, validInput)),
    ).rejects.toThrow(/hook boom/);
    // Subsequent call should NOT trigger the scoped hook — it should
    // use the restored default no-op.
    const result = await postMovement(tx, validInput);
    expect(result.id).toBe("mvmt_fake_1");
    expect(scopedSpy).toHaveBeenCalledTimes(1);
  });
});
