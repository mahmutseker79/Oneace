/**
 * Minimal CSV serializer tailored to OneAce's report exports.
 *
 * The goals are narrow and deliberate:
 *
 * - Support the RFC 4180 escaping rules — quote any field containing a
 *   comma, quote, CR, or LF; double any embedded quotes.
 * - Default to a UTF-8 BOM so Excel on Windows picks up the encoding
 *   (Numbers / Google Sheets don't need it but it doesn't hurt).
 * - Keep `null` / `undefined` as empty cells without blowing up on type
 *   errors — reports join optional relations (supplier, category) freely
 *   and it's tedious to coalesce every one at the call site.
 * - Accept an explicit column spec (header + getter) so we keep control
 *   of column order and heading text independent of the row type's field
 *   names. This also lets us pass the `labels` bag from i18n in without
 *   reaching for a translation lookup inside the serializer.
 *
 * Deliberately out of scope:
 *
 * - Streaming — our reports are bounded (≤ ~1 MB) and we'd rather hand
 *   back a single Response body than wire up a ReadableStream.
 * - Excel-specific quirks beyond the BOM (e.g. `sep=,` hint line) — if
 *   someone complains about a locale, add it behind a flag here.
 */

export type CsvColumn<Row> = {
  header: string;
  value: (row: Row) => string | number | boolean | null | undefined;
};

function escapeCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str === "") return "";
  // RFC 4180: quote if the cell contains ", ',', CR, or LF; double embedded quotes.
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function serializeCsv<Row>(rows: Row[], columns: CsvColumn<Row>[]): string {
  const header = columns.map((c) => escapeCell(c.header)).join(",");
  const body = rows
    .map((row) => columns.map((c) => escapeCell(c.value(row))).join(","))
    .join("\r\n");
  // Prefix with UTF-8 BOM so Excel on Windows opens UTF-8 files correctly.
  const BOM = "\ufeff";
  return rows.length > 0 ? `${BOM}${header}\r\n${body}\r\n` : `${BOM}${header}\r\n`;
}

/**
 * Build a `Response` that Next.js Route Handlers can return directly.
 *
 * The filename is sanitized to ASCII + dashes because older IE/Edge
 * versions choke on anything fancier in the Content-Disposition header,
 * and even modern browsers apply wildly different rules when decoding
 * non-ASCII filenames. For our purposes (items, stock-value, etc.)
 * simple ASCII with a date suffix is plenty.
 */
export function csvResponse(filename: string, csv: string): Response {
  const safeName = filename
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName || "export.csv"}"`,
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Returns an ISO date (YYYY-MM-DD) for the current day in UTC, useful as
 * a suffix on export filenames. We intentionally do not include a time
 * component — it's noisy and pollutes diffs when users compare daily
 * exports.
 */
export function todayIsoDate(): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
