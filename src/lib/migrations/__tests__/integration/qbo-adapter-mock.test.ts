import { describe, it, expect, vi, beforeEach } from "vitest";
import { QBO_MIGRATION_ADAPTER } from "@/lib/migrations/quickbooks-online/adapter";

// Mock the QboMigrationClient module
vi.mock("@/lib/migrations/quickbooks-online/api-client", () => ({
  QboMigrationClient: vi.fn().mockImplementation(() => ({
    listItems: vi.fn().mockResolvedValue([
      {
        Id: "1",
        Name: "Product Item",
        Type: "Inventory",
        Sku: "PROD-001",
        UnitPrice: 75,
      },
    ]),
    listVendors: vi.fn().mockResolvedValue([
      {
        Id: "V1",
        DisplayName: "Vendor A",
        PrimaryContactInfo: { Email: "vendor@a.com" },
      },
    ]),
    listPurchaseOrders: vi.fn().mockResolvedValue([
      {
        Id: "PO1",
        DocNumber: "PO-001",
        TxnDate: "2025-01-15",
        Status: "Open",
        VendorRef: { value: "V1" },
        Line: [{ ItemRef: { value: "1" }, Qty: 10, UnitPrice: 70 }],
      },
    ]),
  })),
}));

describe("qbo-adapter (integration, mocked)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("detects QBO adapter with no files (API-only)", async () => {
    const detection = await QBO_MIGRATION_ADAPTER.detectFiles([]);
    expect(detection).toEqual([]); // API sources have no files to detect
  });

  it("requires credentials in fieldMappings for parsing", async () => {
    // Missing credentials should throw
    await expect(QBO_MIGRATION_ADAPTER.parse([], {})).rejects.toThrow(
      /credentials/i,
    );
  });

  it("returns ParsedSnapshot when credentials are provided", async () => {
    const fieldMappings = {
      credentials: {
        accessToken: "mock-token",
        realmId: "mock-realm",
      },
    };

    const snapshot = await QBO_MIGRATION_ADAPTER.parse([], fieldMappings);

    // Should return a valid snapshot
    expect(snapshot).toBeDefined();
    expect(snapshot.items).toBeDefined();
    expect(snapshot.suppliers).toBeDefined();
    expect(snapshot.purchaseOrders).toBeDefined();
  });
});
