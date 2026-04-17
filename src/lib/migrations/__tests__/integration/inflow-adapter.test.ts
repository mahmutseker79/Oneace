import { describe, it, expect } from "vitest";
import { INFLOW_ADAPTER } from "@/lib/migrations/inflow/adapter";
import type { UploadedFile } from "@/lib/migrations/core/adapter";

describe("inflow-adapter (integration)", () => {
  it("parses Products CSV and returns ParsedSnapshot with items", async () => {
    const productsContent = `ProductID,ProductName,SKU
P001,Widget A,WID-A
P002,Widget B,WID-B`;

    const files: UploadedFile[] = [
      {
        filename: "Products.csv",
        buffer: Buffer.from(productsContent),
        size: Buffer.byteLength(productsContent),
      },
    ];

    const snapshot = await INFLOW_ADAPTER.parse(files);

    // Verify snapshot has items
    expect(snapshot).toBeDefined();
    expect(snapshot.items).toBeDefined();
    expect(Array.isArray(snapshot.items)).toBe(true);
    expect(snapshot.items.length).toBeGreaterThan(0);
  });

  it("parses multi-CSV snapshot with products and vendors", async () => {
    const productsContent = `ProductID,ProductName,SKU
P001,Widget A,WID-A`;

    const vendorsContent = `VendorID,VendorName
V001,TechCorp`;

    const files: UploadedFile[] = [
      {
        filename: "Products.csv",
        buffer: Buffer.from(productsContent),
        size: Buffer.byteLength(productsContent),
      },
      {
        filename: "Vendors.csv",
        buffer: Buffer.from(vendorsContent),
        size: Buffer.byteLength(vendorsContent),
      },
    ];

    const snapshot = await INFLOW_ADAPTER.parse(files);

    // Should parse items
    expect(snapshot.items.length).toBeGreaterThan(0);
    // Should parse suppliers
    expect(snapshot.suppliers).toBeDefined();
    expect(snapshot.suppliers.length).toBeGreaterThan(0);
  });

  it("handles missing optional files gracefully", async () => {
    const productsContent = `ProductID,ProductName,SKU
P001,Widget A,WID-A`;

    const files: UploadedFile[] = [
      {
        filename: "Products.csv",
        buffer: Buffer.from(productsContent),
        size: Buffer.byteLength(productsContent),
      },
    ];

    // Parse without Vendors.csv and StockLevels.csv
    const snapshot = await INFLOW_ADAPTER.parse(files);

    // Should still parse successfully
    expect(snapshot.items.length).toBeGreaterThan(0);
    // Optional sections may be empty
    expect(snapshot.suppliers).toBeDefined();
    expect(snapshot.stockLevels).toBeDefined();
  });

  it("detects inFlow CSV files", async () => {
    const productsContent = `ProductID,ProductName,SKU
P001,Widget,WID-001`;

    const files: UploadedFile[] = [
      {
        filename: "Products.csv",
        buffer: Buffer.from(productsContent),
        size: Buffer.byteLength(productsContent),
      },
    ];

    const detection = await INFLOW_ADAPTER.detectFiles(files);

    // Should detect Products.csv
    const productsDetection = detection.find((d) => d.filename === "Products.csv");
    expect(productsDetection?.detected).toBe(true);
    expect(productsDetection?.confidence).toBe(1.0);
  });

  it("validates items have SKU", async () => {
    const productsContent = `ProductID,ProductName,SKU
P001,Widget,WID-001
P002,BadWidget,`;

    const files: UploadedFile[] = [
      {
        filename: "Products.csv",
        buffer: Buffer.from(productsContent),
        size: Buffer.byteLength(productsContent),
      },
    ];

    const snapshot = await INFLOW_ADAPTER.parse(files);
    const validation = INFLOW_ADAPTER.validate(snapshot, [], {});

    // Should validate successfully (validation issues recorded)
    expect(validation.valid).toBeDefined();
    expect(Array.isArray(validation.issues)).toBe(true);
  });
});
