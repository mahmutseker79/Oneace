/**
 * Phase MIG-S2 — CSV parsing utilities.
 *
 * Provides low-level CSV parsing, delimiter sniffing, and type inference.
 * Adapters (Sortly, inFlow) use these to parse their exports without
 * pulling in a heavy CSV library dependency.
 *
 * Phase S6 additions:
 * - UTF-8 BOM stripping
 * - Windows-1252 charset detection and transcoding
 * - Locale-aware decimal number parsing
 */

/**
 * Normalize a buffer for CSV parsing: strip UTF-8 BOM and transcode
 * Windows-1252 to UTF-8 if detected.
 *
 * @param buffer - Raw bytes from file upload
 * @returns Normalized text string
 */
export function normalizeCsvBuffer(buffer: Buffer): string {
  let text = buffer.toString("utf-8");

  // Strip UTF-8 BOM if present.
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  // Detect Windows-1252 by checking for specific byte patterns in the first 1KB.
  const prefix = buffer.slice(0, Math.min(1024, buffer.length));
  if (isLikelyWindows1252(prefix)) {
    // Transcode from Windows-1252 to UTF-8.
    text = prefix
      .toString("latin1") // Windows-1252 is roughly ISO-8859-1 / latin1 in Node.js
      .concat(buffer.slice(Math.min(1024, buffer.length)).toString("utf-8"));
  }

  return text;
}

/**
 * Heuristic to detect Windows-1252 encoding.
 * Looks for byte patterns common in Windows-1252 that are invalid UTF-8.
 *
 * @param buffer - First portion of file (e.g., 1KB)
 * @returns true if likely Windows-1252, false otherwise
 */
function isLikelyWindows1252(buffer: Buffer): boolean {
  // Look for Windows-1252-specific characters: 0x80–0x9F, 0xA0–0xFF.
  // If we see many high bytes NOT preceded by a valid UTF-8 sequence starter,
  // it's likely Windows-1252.
  let highByteCount = 0;
  let validUtf8Starts = 0;

  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i];

    // UTF-8 multibyte sequence starter: 0xC0–0xFD.
    if (byte >= 0xc0 && byte <= 0xfd) {
      validUtf8Starts++;
    }

    // High bytes (0x80–0xFF).
    if (byte >= 0x80) {
      highByteCount++;
    }
  }

  // If we see high bytes without valid UTF-8 starts, likely Windows-1252.
  // Threshold: at least 2 high bytes, and fewer than 20% are valid UTF-8 starts.
  if (highByteCount > 2 && validUtf8Starts < highByteCount * 0.2) {
    return true;
  }

  return false;
}

/**
 * Parse a CSV buffer into headers + rows.
 * Handles quoted fields, embedded newlines, and common delimiters.
 * Automatically normalizes charset and removes BOM.
 *
 * Does NOT validate — just tokenizes. Adapters are responsible for
 * semantic validation (required fields, type checking, etc.).
 */
export function parseCsv(
  buffer: Buffer,
  delimiter: string = ",",
): {
  headers: string[];
  rows: Record<string, string>[];
} {
  const text = normalizeCsvBuffer(buffer);
  const lines = text.split(/\r?\n/);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  // Parse header line.
  const headers = parseLineIntrinsic(lines[0], delimiter);

  // Parse data rows.
  const rows: Record<string, string>[] = [];
  let currentLine = 1;
  let buffer_accumulate = "";

  while (currentLine < lines.length) {
    let line = lines[currentLine];
    buffer_accumulate += (buffer_accumulate ? "\n" : "") + line;

    // Check if this line completes a quoted field.
    if (isLineComplete(buffer_accumulate)) {
      const fields = parseLineIntrinsic(buffer_accumulate, delimiter);
      const row: Record<string, string> = {};
      for (let i = 0; i < headers.length; i++) {
        row[headers[i]] = fields[i] ?? "";
      }
      rows.push(row);
      buffer_accumulate = "";
    }

    currentLine++;
  }

  return { headers, rows };
}

/**
 * Infer the delimiter (comma, semicolon, tab, pipe) by examining the first line.
 * Returns the most likely delimiter.
 */
export function sniffDelimiter(buffer: Buffer): string {
  const text = buffer.toString("utf-8");
  const firstLine = text.split(/\r?\n/)[0];

  if (!firstLine) return ",";

  const delimiters = [",", ";", "\t", "|"];
  let bestDelim = ",";
  let bestScore = 0;

  for (const delim of delimiters) {
    const count = firstLine.split(delim).length;
    if (count > bestScore) {
      bestScore = count;
      bestDelim = delim;
    }
  }

  return bestDelim;
}

/**
 * Infer a field's type from a sample of values.
 * Returns: "TEXT" | "NUMBER" | "DATE" | "BOOLEAN" | "JSON".
 */
export function inferType(
  values: string[],
): "TEXT" | "NUMBER" | "DATE" | "BOOLEAN" | "JSON" {
  if (!values || values.length === 0) return "TEXT";

  const nonEmpty = values.filter((v) => v && v.trim());
  if (nonEmpty.length === 0) return "TEXT";

  let numberCount = 0;
  let dateCount = 0;
  let boolCount = 0;

  for (const v of nonEmpty) {
    const trimmed = v.trim().toLowerCase();

    // Check boolean.
    if (["true", "false", "yes", "no", "1", "0"].includes(trimmed)) {
      boolCount++;
      continue;
    }

    // Check number.
    if (!isNaN(parseFloat(trimmed)) && isFinite(parseFloat(trimmed))) {
      numberCount++;
      continue;
    }

    // Check date (ISO 8601, US short, EU short).
    if (
      /^\d{4}-\d{2}-\d{2}/.test(trimmed) ||
      /^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(trimmed) ||
      /^\d{1,2}\.\d{1,2}\.\d{2,4}/.test(trimmed)
    ) {
      dateCount++;
      continue;
    }
  }

  const threshold = nonEmpty.length * 0.8;

  if (numberCount >= threshold) return "NUMBER";
  if (dateCount >= threshold) return "DATE";
  if (boolCount >= threshold) return "BOOLEAN";

  return "TEXT";
}

/**
 * Parse a single CSV line, respecting quoted fields.
 */
function parseLineIntrinsic(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote.
        current += '"';
        i++;
      } else {
        // Toggle quote state.
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      // End of field.
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  // Final field.
  fields.push(current);

  return fields;
}

/**
 * Check if a multi-line buffer is complete (has matching quotes).
 */
function isLineComplete(buffer: string): boolean {
  let quoteCount = 0;
  let escaped = false;

  for (const char of buffer) {
    if (char === '"' && !escaped) {
      quoteCount++;
    }
    escaped = char === "\\" && !escaped;
  }

  // If even number of quotes (including none), the line is complete.
  return quoteCount % 2 === 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Locale-aware number parsing (Phase S6)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a decimal number with locale awareness.
 *
 * Detects whether the string uses comma or period as the decimal separator
 * by checking which appears rightmost. Handles currency strings like
 * "1,234.56" (US) or "1.234,56" (EU/TR).
 *
 * @param value - String to parse (e.g., "1,234.56", "1.234,56", "123,4", "-42")
 * @returns Parsed number or null if unparseable
 */
export function parseDecimalLocaleAware(value: string | null | undefined): number | null {
  if (!value || typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  // Remove currency symbols and whitespace.
  let cleaned = trimmed
    .replace(/[^\d.,\-+]/g, "")
    .trim();

  if (!cleaned) return null;

  // Find the rightmost period and comma.
  const lastDot = cleaned.lastIndexOf(".");
  const lastComma = cleaned.lastIndexOf(",");

  let normalized = cleaned;

  if (lastDot === -1 && lastComma === -1) {
    // No decimal separator.
    normalized = cleaned;
  } else if (lastDot > lastComma) {
    // Period is rightmost → US format (period = decimal, remove commas).
    normalized = cleaned.replace(/,/g, "");
  } else if (lastComma > lastDot) {
    // Comma is rightmost → EU format (comma = decimal, remove periods).
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (lastDot === lastComma) {
    // Same position (shouldn't happen), treat as no separator.
    normalized = cleaned;
  }

  const parsed = parseFloat(normalized);
  return isNaN(parsed) || !isFinite(parsed) ? null : parsed;
}
