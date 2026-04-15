// P10.2 — Alert engine unit tests.
//
// These tests mock the Prisma db module to verify the alert evaluation
// logic without requiring a database connection. Each test validates a
// specific decision branch in `evaluateAlerts` and `dismissAlert`.

import { afterEach, describe, expect, it, vi } from "vitest";

// Mock the db module before importing alerts
vi.mock("@/lib/db", () => ({
  db: {
    item: { findMany: vi.fn() },
    alert: { create: vi.fn(), updateMany: vi.fn() },
    notification: { createMany: vi.fn() },
    membership: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { db } from "@/lib/db";
import { dismissAlert, evaluateAlerts } from "./alerts";

const mockDb = db as unknown as {
  item: { findMany: ReturnType<typeof vi.fn> };
  alert: { create: ReturnType<typeof vi.fn>; updateMany: ReturnType<typeof vi.fn> };
  notification: { createMany: ReturnType<typeof vi.fn> };
  membership: { findMany: ReturnType<typeof vi.fn> };
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("evaluateAlerts", () => {
  it("does nothing when itemIds is empty", async () => {
    await evaluateAlerts("org-1", []);
    expect(mockDb.item.findMany).not.toHaveBeenCalled();
  });

  it("creates an alert + notifications when item is low stock with no active alert", async () => {
    mockDb.item.findMany.mockResolvedValue([
      {
        id: "item-1",
        name: "Widget A",
        sku: "WA-001",
        reorderPoint: 10,
        stockLevels: [{ quantity: 3 }, { quantity: 2 }], // onHand = 5
        alerts: [], // no active alert
      },
    ]);
    mockDb.alert.create.mockResolvedValue({ id: "alert-1" });
    mockDb.membership.findMany.mockResolvedValue([{ userId: "user-1" }, { userId: "user-2" }]);
    mockDb.notification.createMany.mockResolvedValue({ count: 2 });

    await evaluateAlerts("org-1", ["item-1"]);

    // Should create an alert
    expect(mockDb.alert.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "org-1",
        itemId: "item-1",
        type: "LOW_STOCK",
        status: "ACTIVE",
        threshold: 10,
        currentQty: 5,
      }),
    });

    // Should fan out notifications to both members
    expect(mockDb.notification.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ userId: "user-1", alertId: "alert-1" }),
        expect.objectContaining({ userId: "user-2", alertId: "alert-1" }),
      ]),
    });
  });

  it("does NOT create an alert when item already has an active alert (dedup)", async () => {
    mockDb.item.findMany.mockResolvedValue([
      {
        id: "item-1",
        name: "Widget A",
        sku: "WA-001",
        reorderPoint: 10,
        stockLevels: [{ quantity: 3 }], // onHand = 3, still low
        alerts: [{ id: "existing-alert" }], // already has an active alert
      },
    ]);

    await evaluateAlerts("org-1", ["item-1"]);

    expect(mockDb.alert.create).not.toHaveBeenCalled();
    expect(mockDb.alert.updateMany).not.toHaveBeenCalled();
  });

  it("auto-resolves active alert when stock recovers above reorder point", async () => {
    mockDb.item.findMany.mockResolvedValue([
      {
        id: "item-1",
        name: "Widget A",
        sku: "WA-001",
        reorderPoint: 10,
        stockLevels: [{ quantity: 15 }], // onHand = 15 > reorderPoint
        alerts: [{ id: "active-alert" }], // has an active alert to resolve
      },
    ]);
    mockDb.alert.updateMany.mockResolvedValue({ count: 1 });

    await evaluateAlerts("org-1", ["item-1"]);

    expect(mockDb.alert.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        organizationId: "org-1",
        itemId: "item-1",
        type: "LOW_STOCK",
        status: "ACTIVE",
      }),
      data: expect.objectContaining({
        status: "RESOLVED",
        resolvedAt: expect.any(Date),
      }),
    });
    // Should NOT create a new alert
    expect(mockDb.alert.create).not.toHaveBeenCalled();
  });

  it("handles items with zero reorder point (no alerts)", async () => {
    // Items with reorderPoint: 0 are filtered out by the db query
    // (reorderPoint: { gt: 0 }), so they won't appear in the results
    mockDb.item.findMany.mockResolvedValue([]);

    await evaluateAlerts("org-1", ["item-1"]);

    expect(mockDb.alert.create).not.toHaveBeenCalled();
    expect(mockDb.alert.updateMany).not.toHaveBeenCalled();
  });

  it("handles exactly-at reorder point as low stock", async () => {
    mockDb.item.findMany.mockResolvedValue([
      {
        id: "item-1",
        name: "Widget A",
        sku: "WA-001",
        reorderPoint: 10,
        stockLevels: [{ quantity: 10 }], // onHand = exactly 10 = reorderPoint
        alerts: [],
      },
    ]);
    mockDb.alert.create.mockResolvedValue({ id: "alert-new" });
    mockDb.membership.findMany.mockResolvedValue([]);
    mockDb.notification.createMany.mockResolvedValue({ count: 0 });

    await evaluateAlerts("org-1", ["item-1"]);

    // onHand (10) <= reorderPoint (10) → should create an alert
    expect(mockDb.alert.create).toHaveBeenCalled();
  });

  it("deduplicates itemIds", async () => {
    mockDb.item.findMany.mockResolvedValue([]);

    await evaluateAlerts("org-1", ["item-1", "item-1", "item-1"]);

    // The db query should receive deduplicated ids
    const callArgs = mockDb.item.findMany.mock.calls[0]?.[0] as
      | { where: { id: { in: string[] } } }
      | undefined;
    expect(callArgs?.where.id.in).toEqual(["item-1"]);
  });

  it("does not throw on db error (fire-and-forget safe)", async () => {
    mockDb.item.findMany.mockRejectedValue(new Error("connection failed"));

    // Should not throw
    await expect(evaluateAlerts("org-1", ["item-1"])).resolves.toBeUndefined();
  });

  it("processes multiple items in a single call", async () => {
    mockDb.item.findMany.mockResolvedValue([
      {
        id: "item-1",
        name: "Widget A",
        sku: "WA-001",
        reorderPoint: 10,
        stockLevels: [{ quantity: 3 }],
        alerts: [],
      },
      {
        id: "item-2",
        name: "Gadget B",
        sku: "GB-002",
        reorderPoint: 5,
        stockLevels: [{ quantity: 20 }],
        alerts: [{ id: "alert-to-resolve" }],
      },
    ]);
    mockDb.alert.create.mockResolvedValue({ id: "new-alert" });
    mockDb.membership.findMany.mockResolvedValue([{ userId: "user-1" }]);
    mockDb.notification.createMany.mockResolvedValue({ count: 1 });
    mockDb.alert.updateMany.mockResolvedValue({ count: 1 });

    await evaluateAlerts("org-1", ["item-1", "item-2"]);

    // item-1: low stock → create alert
    expect(mockDb.alert.create).toHaveBeenCalledTimes(1);
    // item-2: stock recovered → resolve alert
    expect(mockDb.alert.updateMany).toHaveBeenCalledTimes(1);
  });
});

describe("dismissAlert", () => {
  it("returns true when alert is found and dismissed", async () => {
    mockDb.alert.updateMany.mockResolvedValue({ count: 1 });

    const result = await dismissAlert("alert-1", "org-1", "user-1");

    expect(result).toBe(true);
    expect(mockDb.alert.updateMany).toHaveBeenCalledWith({
      where: {
        id: "alert-1",
        organizationId: "org-1",
        status: "ACTIVE",
      },
      data: expect.objectContaining({
        status: "DISMISSED",
        dismissedAt: expect.any(Date),
        dismissedById: "user-1",
      }),
    });
  });

  it("returns false when alert is not found or already resolved", async () => {
    mockDb.alert.updateMany.mockResolvedValue({ count: 0 });

    const result = await dismissAlert("nonexistent", "org-1", "user-1");

    expect(result).toBe(false);
  });
});
