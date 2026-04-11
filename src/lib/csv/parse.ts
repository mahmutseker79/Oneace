// Minimal RFC 4180 CSV parser.
//
// We roll our own instead of adding papaparse because:
//   1. This is 70 lines of straightforward state machine — smaller than
//      the papaparse bundle and zero extra dependency footprint.
//   2. Keeping the parser pure lets the same code run in the browser
//      (for the import preview) and on the server (for a future CLI or
//      bulk ingest job).
//
// Supports:
//   - Comma, semicolon, or tab delimiters (auto-detected or passed in)
//   - CRLF and LF line endings
//   - Double-quoted fields with escaped quotes ("" → ")
//   - Embedded newlines inside quoted fields
//   - Empty fields and trailing empty lines
//
// Does NOT support:
//   - Comment lines
//   - Non-UTF-8 encodings (caller must decode upstream)
//   - Streaming — input is a single string. For our use case the file
//     is already in memory as a FileReader result, so this is fine.

export type CsvDelimiter = "," | ";" | "\t";

export type ParseCsvOptions = {
  /**
   * The column delimiter. Defaults to auto-detect from the first line:
   * comma > semicolon > tab, whichever appears first.
   */
  delimiter?: CsvDelimiter;
  /**
   * If true, the first row is returned as the `header` and subsequent
   * rows as `rows`. If false, all rows are in `rows` and `header` is
   * `null`. Defaults to true.
   */
  hasHeader?: boolean;
  /**
   * Maximum number of rows to parse (excluding header). Extra rows are
   * silently dropped. Defaults to Number.POSITIVE_INFINITY.
   */
  maxRows?: number;
};

export type ParseCsvResult = {
  header: string[] | null;
  rows: string[][];
  /** Delimiter that was actually used (useful when auto-detecting). */
  delimiter: CsvDelimiter;
  /** Total rows parsed, not counting the header. */
  rowCount: number;
};

function autoDetectDelimiter(input: string): CsvDelimiter {
  // Look only at the first physical line to avoid delimiter confusion
  // from data values containing commas.
  const firstLineEnd = input.indexOf("\n");
  const firstLine = firstLineEnd === -1 ? input : input.slice(0, firstLineEnd);
  const counts = {
    ",": (firstLine.match(/,/g) || []).length,
    ";": (firstLine.match(/;/g) || []).length,
    "\t": (firstLine.match(/\t/g) || []).length,
  };
  if (counts["\t"] >= counts[","] && counts["\t"] >= counts[";"] && counts["\t"] > 0) {
    return "\t";
  }
  if (counts[";"] > counts[","]) return ";";
  return ",";
}

/**
 * Parse a CSV string into rows. Handles quoted fields, escaped quotes,
 * embedded newlines, and mixed line endings.
 *
 * Returns `{ header, rows }`. Trailing empty lines are ignored. If the
 * input is empty, returns a result with `header = null` and `rows = []`.
 */
export function parseCsv(input: string, options: ParseCsvOptions = {}): ParseCsvResult {
  const hasHeader = options.hasHeader ?? true;
  const maxRows = options.maxRows ?? Number.POSITIVE_INFINITY;
  const delimiter = options.delimiter ?? autoDetectDelimiter(input);

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;
  let i = 0;

  // Strip a UTF-8 BOM if present. Excel likes to add these.
  if (input.charCodeAt(0) === 0xfeff) {
    i = 1;
  }

  while (i < input.length) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        const next = input[i + 1];
        if (next === '"') {
          // Escaped double-quote → literal "
          currentField += '"';
          i += 2;
          continue;
        }
        // Closing quote
        inQuotes = false;
        i += 1;
        continue;
      }
      currentField += char;
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }

    if (char === delimiter) {
      currentRow.push(currentField);
      currentField = "";
      i += 1;
      continue;
    }

    if (char === "\r") {
      // Ignore — LF handler below finalizes the row
      i += 1;
      continue;
    }

    if (char === "\n") {
      currentRow.push(currentField);
      currentField = "";
      if (!isEmptyRow(currentRow)) {
        rows.push(currentRow);
      }
      currentRow = [];
      i += 1;
      continue;
    }

    currentField += char;
    i += 1;
  }

  // Flush the last row if the file doesn't end with a newline.
  if (currentField !== "" || currentRow.length > 0) {
    currentRow.push(currentField);
    if (!isEmptyRow(currentRow)) {
      rows.push(currentRow);
    }
  }

  let header: string[] | null = null;
  let dataRows = rows;
  if (hasHeader && rows.length > 0) {
    header = rows[0] ?? null;
    dataRows = rows.slice(1);
  }
  if (dataRows.length > maxRows) {
    dataRows = dataRows.slice(0, maxRows);
  }

  return {
    header,
    rows: dataRows,
    delimiter,
    rowCount: dataRows.length,
  };
}

/**
 * A row is "empty" if it has exactly one field and that field is the
 * empty string. We drop these silently — they come from trailing
 * newlines and blank spacer rows in Excel exports.
 */
function isEmptyRow(row: string[]): boolean {
  return row.length === 1 && row[0] === "";
}

/**
 * Auto-map source columns to canonical field names based on fuzzy
 * header matching. Returns a record `{ canonicalField → sourceIndex }`.
 * Unmapped canonical fields are omitted from the result — callers
 * should treat a missing entry as "not mapped".
 *
 * Matching is case-insensitive and ignores whitespace / underscores /
 * dashes so "Sale Price", "sale_price", and "sale-price" all match the
 * same canonical field.
 */
export function autoMapHeaders(
  sourceHeaders: readonly string[],
  aliases: Readonly<Record<string, readonly string[]>>,
): Record<string, number> {
  const normalize = (s: string) => s.toLowerCase().replace(/[\s_\-./]/g, "");
  const normalizedSource = sourceHeaders.map(normalize);
  const result: Record<string, number> = {};

  for (const [canonical, aliasList] of Object.entries(aliases)) {
    for (const alias of aliasList) {
      const normalizedAlias = normalize(alias);
      const idx = normalizedSource.indexOf(normalizedAlias);
      if (idx !== -1) {
        result[canonical] = idx;
        break;
      }
    }
  }

  return result;
}
