import { describe, it, expect } from "vitest";
import { SORTLY_ADAPTER } from "@/lib/migrations/sortly/adapter";
import type { UploadedFile } from "@/lib/migrations/core/adapter";

describe("sortly-adapter (integration)", () => {
  it("parses basic Sortly CSV and returns ParsedSnapshot", async () => {
    const csvContent = `Name,SKU,Quantity
Widget A,WID-001,100
Widget B,WID-002,50`;

    const csvBuffer = Buffer.from(csvContent);
    const files: UploadedFile[] = [
      {
        filename: "items.csv",
        buffer: csvBuffer,
        size: csvBuffer.length,
      },
    ];

    const snapshot = await SORTLY_ADAPTER.parse(files);

    // Verify snapshot structure exists
    expect(snapshot).toBeDefined();
    expect(snapshot.items).toBeDefined();
    expect(Array.isArray(snapshot.items)).toBe(true);
    expect(snapshot.items.length).toBeGreaterThan(0);
  });

  it("creates categories from folder path hierarchy", async () => {
    const csvContent = `Name,SKU,Folder Path
Item 1,SKU-001,Electronics/Phones
Item 2,SKU-002,Electronics/Tablets`;

    const csvBuffer = Buffer.from(csvContent);
    const files: UploadedFile[] = [
      {
        filename: "items.csv",
        buffer: csvBuffer,
        size: csvBuffer.length,
      },
    ];

    const snapshot = await SORTLY_ADAPTER.parse(files);

    // Should have categories from folder paths
    expect(snapshot.categories).toBeDefined();
    expect(Array.isArray(snapshot.categories)).toBe(true);
    expect(snapshot.categories.length).toBeGreaterThan(0);
  });

  it("validates items have SKU", async () => {
    const csvContent = `Name,SKU
Widget A,WID-001
Widget B,`;

    const csvBuffer = Buffer.from(csvContent);
    const files: UploadedFile[] = [
      {
        filename: "items.csv",
        buffer: csvBuffer,
        size: csvBuffer.length,
      },
    ];

    const snapshot = await SORTLY_ADAPTER.parse(files);
    const validation = SORTLY_ADAPTER.validate(snapshot, [], {});

    // Should surface validation issues
    expect(validation.valid).toBeDefined();
    expect(Array.isArray(validation.issues)).toBe(true);
  });

  it("detects file as Sortly CSV with high confidence", async () => {
    const csvBuffer = Buffer.from("Name,SKU\nWidget,WID-001");
    const files: UploadedFile[] = [
      {
        filename: "items.csv",
        buffer: csvBuffer,
        size: csvBuffer.length,
      },
    ];

    const detection = await SORTLY_ADAPTER.detectFiles(files);
    expect(detection).toHaveLength(1);
    expect(detection[0]?.detected).toBe(true);
    expect(detection[0]?.confidence).toBe(1.0); // items.csv is exact match
  });
});
