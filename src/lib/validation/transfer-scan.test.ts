// Phase 11.4 — Transfer wizard scan matching tests.
//
// Tests the matchItemByCode function exported from transfer-wizard.tsx.
// The function is pure — no DOM, no db, no env dependency.
//
// We inline the logic here (same pattern as po-receive-scan.test.ts)
// to avoid importing from a client component that uses JSX and React hooks,
// which would require a different test environment.

import { describe, expect, it } from "vitest";

type ItemOption = {
  id: string;
  name: string;
  sku: string;
  barcode?: string | null;
};

/**
 * Replica of matchItemByCode from transfer-wizard.tsx.
 * If the implementation changes, update both.
 */
function matchItemByCode(items: ItemOption[], code: string): ItemOption | null {
  const trimmed = code.trim();
  if (!trimmed) return null;

  // Priority 1: barcode exact match
  const byBarcode = items.find(
    (i) => i.barcode != null && i.barcode !== "" && i.barcode === trimmed,
  );
  if (byBarcode) return byBarcode;

  // Priority 2: SKU case-insensitive
  const lower = trimmed.toLowerCase();
  return items.find((i) => i.sku.toLowerCase() === lower) ?? null;
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const catalog: ItemOption[] = [
  { id: "item-1", name: "Widget A", sku: "WGT-001", barcode: "5901234123457" },
  { id: "item-2", name: "Widget B", sku: "WGT-002", barcode: null },
  { id: "item-3", name: "Widget C", sku: "WGT-003", barcode: "" },
  { id: "item-4", name: "Widget D", sku: "WGT-004", barcode: "BARCODE-D" },
];

// ---------------------------------------------------------------------------
// Barcode match
// ---------------------------------------------------------------------------

describe("matchItemByCode — barcode match", () => {
  it("matches by exact barcode", () => {
    expect(matchItemByCode(catalog, "5901234123457")?.id).toBe("item-1");
  });

  it("does not match partial barcode", () => {
    expect(matchItemByCode(catalog, "590123412345")).toBeNull();
  });

  it("does not match barcode with trailing character", () => {
    expect(matchItemByCode(catalog, "5901234123457X")).toBeNull();
  });

  it("trims whitespace before barcode match", () => {
    expect(matchItemByCode(catalog, "  5901234123457  ")?.id).toBe("item-1");
  });

  it("does not match item whose barcode is null", () => {
    // WGT-002 has barcode=null — should not match any barcode scan
    expect(matchItemByCode(catalog, "null")).toBeNull();
  });

  it("does not match item whose barcode is empty string", () => {
    // WGT-003 has barcode="" — should not be treated as a barcode match
    expect(matchItemByCode(catalog, "")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// SKU match
// ---------------------------------------------------------------------------

describe("matchItemByCode — SKU match", () => {
  it("matches by exact SKU", () => {
    expect(matchItemByCode(catalog, "WGT-002")?.id).toBe("item-2");
  });

  it("matches SKU case-insensitively (lowercase)", () => {
    expect(matchItemByCode(catalog, "wgt-002")?.id).toBe("item-2");
  });

  it("matches SKU case-insensitively (mixed case)", () => {
    expect(matchItemByCode(catalog, "Wgt-002")?.id).toBe("item-2");
  });

  it("trims whitespace before SKU match", () => {
    expect(matchItemByCode(catalog, "  WGT-002  ")?.id).toBe("item-2");
  });

  it("matches item with null barcode by SKU", () => {
    // item-2 has no barcode — falls through to SKU match
    expect(matchItemByCode(catalog, "WGT-002")?.id).toBe("item-2");
  });

  it("matches item with empty string barcode by SKU", () => {
    // item-3 has barcode="" — not a valid barcode, falls through to SKU
    expect(matchItemByCode(catalog, "WGT-003")?.id).toBe("item-3");
  });
});

// ---------------------------------------------------------------------------
// Priority: barcode before SKU
// ---------------------------------------------------------------------------

describe("matchItemByCode — priority: barcode before SKU", () => {
  it("prefers barcode match when a barcode equals another item's SKU", () => {
    const ambiguous: ItemOption[] = [
      { id: "a", name: "A", sku: "OVERLAP", barcode: null },
      { id: "b", name: "B", sku: "WGT-B", barcode: "OVERLAP" },
    ];
    // Scanning "OVERLAP" should hit item-b by barcode, not item-a by SKU
    expect(matchItemByCode(ambiguous, "OVERLAP")?.id).toBe("b");
  });
});

// ---------------------------------------------------------------------------
// Not found
// ---------------------------------------------------------------------------

describe("matchItemByCode — not found", () => {
  it("returns null for empty string", () => {
    expect(matchItemByCode(catalog, "")).toBeNull();
  });

  it("returns null for whitespace-only input", () => {
    expect(matchItemByCode(catalog, "   ")).toBeNull();
  });

  it("returns null for unknown barcode", () => {
    expect(matchItemByCode(catalog, "UNKNOWN-BARCODE")).toBeNull();
  });

  it("returns null for unknown SKU", () => {
    expect(matchItemByCode(catalog, "WGT-NOTEXIST")).toBeNull();
  });

  it("returns null for empty catalog", () => {
    expect(matchItemByCode([], "WGT-001")).toBeNull();
  });
});
