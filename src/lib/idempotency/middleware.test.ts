// src/lib/idempotency/middleware.test.ts
//
// Unit test for withIdempotency. No Prisma, no database — stubs
// `idempotencyKey` with an in-memory fake to pin the behaviour at
// the middleware boundary.

import { describe, expect, it, vi } from "vitest";

import {
  IdempotencyConflictError,
  type IdempotencyDbClient,
  IdempotencyInProgressError,
  deriveKeyHash,
  derivePayloadFingerprint,
  withIdempotency,
} from "./middleware";

/**
 * In-memory fake that mimics the two Prisma methods the middleware
 * uses: findUnique + upsert + update. Keyed by (orgId, keyHash).
 */
function makeFakeDb() {
  const store = new Map<
    string,
    {
      organizationId: string;
      keyHash: string;
      actionName: string;
      requestFingerprint: string;
      responseJson: unknown;
      state: "IN_FLIGHT" | "COMPLETED" | "FAILED";
      createdAt: Date;
      completedAt: Date | null;
      expiresAt: Date;
    }
  >();

  const k = (orgId: string, hash: string) => `${orgId}::${hash}`;

  const db: IdempotencyDbClient = {
    idempotencyKey: {
      // @ts-expect-error — stubbing the Prisma surface we actually use
      findUnique: async ({ where }) => {
        const { organizationId, keyHash } = where.organizationId_keyHash;
        return store.get(k(organizationId, keyHash)) ?? null;
      },
      // @ts-expect-error — same
      upsert: async ({ where, create, update }) => {
        const { organizationId, keyHash } = where.organizationId_keyHash;
        const existing = store.get(k(organizationId, keyHash));
        if (existing) {
          const merged = { ...existing, ...update };
          store.set(k(organizationId, keyHash), merged);
          return merged;
        }
        const row = {
          organizationId,
          keyHash,
          actionName: create.actionName,
          requestFingerprint: create.requestFingerprint,
          responseJson: null,
          state: create.state,
          createdAt: new Date(),
          completedAt: null,
          expiresAt: create.expiresAt,
        };
        store.set(k(organizationId, keyHash), row);
        return row;
      },
      // @ts-expect-error — same
      update: async ({ where, data }) => {
        const { organizationId, keyHash } = where.organizationId_keyHash;
        const existing = store.get(k(organizationId, keyHash));
        if (!existing) throw new Error("update: row not found");
        const merged = { ...existing, ...data };
        store.set(k(organizationId, keyHash), merged);
        return merged;
      },
    } as unknown as IdempotencyDbClient["idempotencyKey"],
  };

  return { db, store };
}

const baseCfg = {
  organizationId: "org_1",
  actionName: "shipSalesOrder",
  key: "req_abc",
  payload: { orderId: "so_1", lines: [{ id: "sol_1", qty: 5 }] },
};

describe("withIdempotency — invariants", () => {
  it("rejects empty organizationId", async () => {
    const { db } = makeFakeDb();
    await expect(
      withIdempotency({ ...baseCfg, organizationId: "" }, async () => "x", db),
    ).rejects.toThrow(/organizationId is required/);
  });

  it("rejects empty actionName", async () => {
    const { db } = makeFakeDb();
    await expect(
      withIdempotency({ ...baseCfg, actionName: "" }, async () => "x", db),
    ).rejects.toThrow(/actionName is required/);
  });

  it("pass-through (no caching) when key is missing", async () => {
    const { db, store } = makeFakeDb();
    const fn = vi.fn(async () => ({ ok: true, id: "so_1" }));
    const result = await withIdempotency({ ...baseCfg, key: undefined }, fn, db);
    expect(result).toEqual({ ok: true, id: "so_1" });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(store.size).toBe(0);
  });

  it("pass-through (no caching) when key is whitespace only", async () => {
    const { db, store } = makeFakeDb();
    const fn = vi.fn(async () => "ok");
    await withIdempotency({ ...baseCfg, key: "   " }, fn, db);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(store.size).toBe(0);
  });
});

describe("withIdempotency — happy path + replay", () => {
  it("first call runs the function and caches the result", async () => {
    const { db, store } = makeFakeDb();
    const fn = vi.fn(async () => ({ ok: true, id: "so_1" }));
    const result = await withIdempotency(baseCfg, fn, db);
    expect(result).toEqual({ ok: true, id: "so_1" });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(store.size).toBe(1);
    const [row] = [...store.values()];
    expect(row?.state).toBe("COMPLETED");
    expect(row?.responseJson).toEqual({ ok: true, id: "so_1" });
  });

  it("replay with identical payload returns cached response without re-running", async () => {
    const { db } = makeFakeDb();
    const fn = vi.fn(async () => ({ ok: true, id: "so_1" }));
    const first = await withIdempotency(baseCfg, fn, db);
    const second = await withIdempotency(baseCfg, fn, db);
    expect(second).toEqual(first);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("replay with payload key order swap is still a cache hit (canonicalization)", async () => {
    const { db } = makeFakeDb();
    const fn = vi.fn(async () => ({ ok: true }));
    await withIdempotency(baseCfg, fn, db);
    const scrambled = {
      ...baseCfg,
      payload: { lines: baseCfg.payload.lines, orderId: baseCfg.payload.orderId },
    };
    await withIdempotency(scrambled, fn, db);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("replay with mismatched payload throws IdempotencyConflictError", async () => {
    const { db } = makeFakeDb();
    const fn = vi.fn(async () => ({ ok: true }));
    await withIdempotency(baseCfg, fn, db);
    await expect(
      withIdempotency({ ...baseCfg, payload: { orderId: "so_1", lines: [] } }, fn, db),
    ).rejects.toBeInstanceOf(IdempotencyConflictError);
  });
});

describe("withIdempotency — in-flight + failure states", () => {
  it("replay while IN_FLIGHT throws IdempotencyInProgressError", async () => {
    const { db, store } = makeFakeDb();
    // Seed an IN_FLIGHT row directly (simulates a concurrent caller
    // that hasn't finished yet).
    const keyHash = deriveKeyHash(baseCfg.actionName, baseCfg.key);
    const fingerprint = derivePayloadFingerprint(baseCfg.payload);
    store.set(`${baseCfg.organizationId}::${keyHash}`, {
      organizationId: baseCfg.organizationId,
      keyHash,
      actionName: baseCfg.actionName,
      requestFingerprint: fingerprint,
      responseJson: null,
      state: "IN_FLIGHT",
      createdAt: new Date(),
      completedAt: null,
      expiresAt: new Date(Date.now() + 10_000),
    });
    await expect(withIdempotency(baseCfg, async () => "x", db)).rejects.toBeInstanceOf(
      IdempotencyInProgressError,
    );
  });

  it("previous FAILED state lets a new attempt re-run", async () => {
    const { db, store } = makeFakeDb();
    const keyHash = deriveKeyHash(baseCfg.actionName, baseCfg.key);
    const fingerprint = derivePayloadFingerprint(baseCfg.payload);
    store.set(`${baseCfg.organizationId}::${keyHash}`, {
      organizationId: baseCfg.organizationId,
      keyHash,
      actionName: baseCfg.actionName,
      requestFingerprint: fingerprint,
      responseJson: null,
      state: "FAILED",
      createdAt: new Date(Date.now() - 1000),
      completedAt: new Date(Date.now() - 500),
      expiresAt: new Date(Date.now() + 10_000),
    });
    const fn = vi.fn(async () => ({ ok: true }));
    const result = await withIdempotency(baseCfg, fn, db);
    expect(result).toEqual({ ok: true });
    expect(fn).toHaveBeenCalledTimes(1);
    const row = store.get(`${baseCfg.organizationId}::${keyHash}`);
    expect(row?.state).toBe("COMPLETED");
  });

  it("handler throw marks state=FAILED and rethrows the error", async () => {
    const { db, store } = makeFakeDb();
    const boom = new Error("boom");
    await expect(
      withIdempotency(
        baseCfg,
        async () => {
          throw boom;
        },
        db,
      ),
    ).rejects.toBe(boom);
    const [row] = [...store.values()];
    expect(row?.state).toBe("FAILED");
  });

  it("expired row is treated as absent — fn runs, row is refreshed to IN_FLIGHT then COMPLETED", async () => {
    const { db, store } = makeFakeDb();
    const keyHash = deriveKeyHash(baseCfg.actionName, baseCfg.key);
    const fingerprint = derivePayloadFingerprint(baseCfg.payload);
    store.set(`${baseCfg.organizationId}::${keyHash}`, {
      organizationId: baseCfg.organizationId,
      keyHash,
      actionName: baseCfg.actionName,
      requestFingerprint: fingerprint,
      responseJson: { stale: true },
      state: "COMPLETED",
      createdAt: new Date(Date.now() - 10_000),
      completedAt: new Date(Date.now() - 9_000),
      // expired 1s ago
      expiresAt: new Date(Date.now() - 1000),
    });
    const fn = vi.fn(async () => ({ fresh: true }));
    const result = await withIdempotency(baseCfg, fn, db);
    expect(result).toEqual({ fresh: true });
    expect(fn).toHaveBeenCalledTimes(1);
    const row = store.get(`${baseCfg.organizationId}::${keyHash}`);
    expect(row?.responseJson).toEqual({ fresh: true });
  });
});

describe("fingerprinting — stable across key order", () => {
  it("same values, different key order → same fingerprint", () => {
    const a = derivePayloadFingerprint({ a: 1, b: 2 });
    const b = derivePayloadFingerprint({ b: 2, a: 1 });
    expect(a).toBe(b);
  });
  it("undefined values are dropped", () => {
    const a = derivePayloadFingerprint({ a: 1, b: undefined });
    const b = derivePayloadFingerprint({ a: 1 });
    expect(a).toBe(b);
  });
  it("arrays keep order (semantic)", () => {
    const a = derivePayloadFingerprint([1, 2, 3]);
    const b = derivePayloadFingerprint([3, 2, 1]);
    expect(a).not.toBe(b);
  });
  it("different action names → different keyHash even with same raw key", () => {
    const a = deriveKeyHash("shipSalesOrder", "k");
    const b = deriveKeyHash("receivePurchaseOrder", "k");
    expect(a).not.toBe(b);
  });
});
