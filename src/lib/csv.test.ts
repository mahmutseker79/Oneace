// Pure-function tests for the CSV serializer.
// Covers RFC 4180 escaping, UTF-8 BOM, and empty-dataset edge cases.

import { describe, expect, it } from "vitest";

import { serializeCsv, type CsvColumn } from "./csv";

type Row = { name: string; qty: number | null; note: string | undefined };

const COLUMNS = [
  { header: "Name", value: (r: Row) => r.name },
  { header: "Qty", value: (r: Row) => r.qty },
  { header: "Note", value: (r: Row) => r.note },
] as const as CsvColumn<Row>[];

const BOM = "\ufeff";

describe("serializeCsv", () => {
  it("produces a BOM + header-only row when given zero rows", () => {
    const result = serializeCsv([], COLUMNS);
    expect(result).toBe(`${BOM}Name,Qty,Note\r\n`);
  });

  it("produces BOM + header + data rows for normal input", () => {
    const rows: Row[] = [{ name: "Widget", qty: 10, note: "ok" }];
    const result = serializeCsv(rows, COLUMNS);
    expect(result).toBe(`${BOM}Name,Qty,Note\r\nWidget,10,ok\r\n`);
  });

  it("serializes null and undefined as empty cells", () => {
    const rows: Row[] = [{ name: "A", qty: null, note: undefined }];
    const result = serializeCsv(rows, COLUMNS);
    expect(result).toContain("A,,\r\n");
  });

  it("quotes cells that contain commas", () => {
    const rows: Row[] = [{ name: "Widget, Pro", qty: 1, note: "" }];
    const result = serializeCsv(rows, COLUMNS);
    expect(result).toContain('"Widget, Pro"');
  });

  it("escapes embedded double-quotes by doubling them (RFC 4180)", () => {
    const rows: Row[] = [{ name: 'Say "hello"', qty: 1, note: "" }];
    const result = serializeCsv(rows, COLUMNS);
    expect(result).toContain('"Say ""hello"""');
  });

  it("quotes cells containing newlines", () => {
    const rows: Row[] = [{ name: "Line1\nLine2", qty: 1, note: "" }];
    const result = serializeCsv(rows, COLUMNS);
    expect(result).toContain('"Line1\nLine2"');
  });

  it("multiple rows are separated by CRLF", () => {
    const rows: Row[] = [
      { name: "A", qty: 1, note: "" },
      { name: "B", qty: 2, note: "" },
    ];
    const result = serializeCsv(rows, COLUMNS);
    expect(result).toContain("A,1,\r\nB,2,\r\n");
  });

  it("emits exactly one BOM at the start", () => {
    const rows: Row[] = [{ name: "X", qty: 0, note: "" }];
    const result = serializeCsv(rows, COLUMNS);
    expect(result.startsWith(BOM)).toBe(true);
    // BOM appears only once
    expect(result.indexOf(BOM, 1)).toBe(-1);
  });
});
