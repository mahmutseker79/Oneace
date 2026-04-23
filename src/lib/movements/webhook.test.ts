// src/lib/movements/webhook.test.ts
//
// Unit tests for postWebhookMovement. Pure pass-through + key
// derivation — no database.

import { describe, expect, it, vi } from "vitest";

import type { TxClient } from "./post";
import { postWebhookMovement } from "./webhook";

function makeFakeTx() {
  const calls: Array<{ data: Record<string, unknown> }> = [];
  const tx: TxClient = {
    stockMovement: {
      // @ts-expect-error — stubbing the subset we use
      create: async ({ data }: { data: Record<string, unknown> }) => {
        calls.push({ data });
        return {
          id: "mv_fake",
          organizationId: data.organizationId,
          itemId: data.itemId,
          warehouseId: data.warehouseId,
          type: data.type,
          quantity: data.quantity,
          direction: data.direction ?? 1,
          idempotencyKey: data.idempotencyKey,
          createdAt: new Date(),
          reference: data.reference ?? null,
          note: data.note ?? null,
        };
      },
    } as unknown as TxClient["stockMovement"],
  };
  return { tx, calls };
}

const baseInput = {
  organizationId: "org_1",
  itemId: "item_1",
  warehouseId: "wh_1",
  type: "RECEIPT" as const,
  quantity: 5,
};

describe("postWebhookMovement", () => {
  it("derives a wh:{provider}:{deliveryId} idempotency key", async () => {
    const { tx, calls } = makeFakeTx();
    await postWebhookMovement(tx, {
      ...baseInput,
      provider: "shopify",
      deliveryId: "abc-123",
    });
    expect(calls).toHaveLength(1);
    expect((calls[0]!.data as { idempotencyKey: string }).idempotencyKey).toBe(
      "wh:shopify:abc-123",
    );
  });

  it("is deterministic: same (provider, deliveryId) → same key", async () => {
    const { tx, calls } = makeFakeTx();
    await postWebhookMovement(tx, {
      ...baseInput,
      provider: "shopify",
      deliveryId: "abc",
    });
    await postWebhookMovement(tx, {
      ...baseInput,
      provider: "shopify",
      deliveryId: "abc",
    });
    const k1 = (calls[0]!.data as { idempotencyKey: string }).idempotencyKey;
    const k2 = (calls[1]!.data as { idempotencyKey: string }).idempotencyKey;
    expect(k1).toBe(k2);
  });

  it("differs across providers", async () => {
    const { tx, calls } = makeFakeTx();
    await postWebhookMovement(tx, {
      ...baseInput,
      provider: "shopify",
      deliveryId: "abc",
    });
    await postWebhookMovement(tx, {
      ...baseInput,
      provider: "quickbooks",
      deliveryId: "abc",
    });
    const k1 = (calls[0]!.data as { idempotencyKey: string }).idempotencyKey;
    const k2 = (calls[1]!.data as { idempotencyKey: string }).idempotencyKey;
    expect(k1).not.toBe(k2);
  });

  it("rejects invalid provider shape (rejects uppercase)", async () => {
    const { tx } = makeFakeTx();
    await expect(
      postWebhookMovement(tx, {
        ...baseInput,
        provider: "Shopify",
        deliveryId: "abc",
      }),
    ).rejects.toThrow(/invalid provider/);
  });

  it("rejects empty deliveryId", async () => {
    const { tx } = makeFakeTx();
    await expect(
      postWebhookMovement(tx, {
        ...baseInput,
        provider: "shopify",
        deliveryId: "",
      }),
    ).rejects.toThrow(/deliveryId required/);
  });

  it("forwards all other fields to postMovement unchanged", async () => {
    const { tx, calls } = makeFakeTx();
    const onChange = vi.fn();
    void onChange;
    await postWebhookMovement(tx, {
      ...baseInput,
      provider: "shopify",
      deliveryId: "abc",
      reference: "shopify:order:1001",
      note: "via inventory_levels/update",
      direction: 1,
      createdByUserId: null,
    });
    const persisted = calls[0]!.data;
    expect(persisted.reference).toBe("shopify:order:1001");
    expect(persisted.note).toBe("via inventory_levels/update");
    expect(persisted.direction).toBe(1);
  });
});
