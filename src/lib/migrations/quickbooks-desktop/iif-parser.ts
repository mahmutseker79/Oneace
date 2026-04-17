/**
 * Phase QBD-1 — IIF (Intuit Interchange Format) parser.
 *
 * IIF is a tab-delimited, record-type-based text format used by QuickBooks Desktop exports.
 * Format:
 *   - Header rows: !<TYPE>\t<FIELD1>\t<FIELD2>\t...
 *   - Data rows: <TYPE>\t<VALUE1>\t<VALUE2>\t...
 *   - One file can contain multiple record types interleaved.
 *   - Quoted fields handle tabs/newlines inside values.
 *   - Character encoding: often Windows-1252 on legacy exports.
 *
 * Common record types OneAce cares about:
 *   - INVITEM: inventory item (product)
 *   - VEND: vendor/supplier
 *   - CUST: customer (ignored for OneAce)
 *   - CLASS: classification (mapped to category)
 *   - PURCHORDR: purchase order header
 *   - SPL: split/line item (belongs to parent PURCHORDR or BILL)
 *   - ACCNT: account (mostly ignored)
 */

import { normalizeCsvBuffer } from "@/lib/migrations/core/csv-utils";

/**
 * A single IIF record with its type and parsed fields.
 */
export interface IifRecord {
  type: string;
  fields: Record<string, string>;
}

/**
 * Parsed IIF document grouped by record type.
 */
export interface IifDocument {
  recordsByType: Map<string, IifRecord[]>;
  warnings: string[];
}

/**
 * Parse an IIF file buffer into a structured document.
 *
 * @param buffer - Raw file bytes
 * @returns IifDocument with records grouped by type and any parse warnings
 */
export function parseIifFile(buffer: Buffer | string): IifDocument {
  const text = typeof buffer === "string" ? buffer : normalizeCsvBuffer(buffer);
  const lines = text.split(/\r?\n/);

  const recordsByType = new Map<string, IifRecord[]>();
  const warnings: string[] = [];

  let currentType: string | null = null;
  let currentHeaders: string[] = [];
  let lineNumber = 0;

  for (const line of lines) {
    lineNumber++;

    // Skip empty lines.
    if (!line.trim()) continue;

    // Check if this is a header or data line.
    const isHeader = line.startsWith("!");

    if (isHeader) {
      // Parse header: !TYPE\tFIELD1\tFIELD2\t...
      const trimmedHeader = line.substring(1); // Remove leading !
      const parts = parseTabLine(trimmedHeader);

      if (parts.length > 0 && parts[0]) {
        currentType = parts[0];
        currentHeaders = parts.slice(1);
      }
    } else {
      // Parse data row: TYPE\tVAL1\tVAL2\t...
      const parts = parseTabLine(line);

      if (parts.length === 0 || !parts[0]) continue;

      const rowType: string = parts[0];

      // If we have a matching header, use it. Otherwise, warn and skip.
      if (!currentType || rowType !== currentType) {
        // Type mismatch or no header seen yet. Try to infer from row.
        // If we've never seen a header for this type, treat the row as both type and values.
        if (!recordsByType.has(rowType)) {
          // First time seeing this type without a header. Warn and use row values as-is.
          warnings.push(
            `Line ${lineNumber}: Record type ${rowType} has no header; treating first row as values.`,
          );
          currentType = rowType;
          currentHeaders = [];
        }
      }

      // Build the record from row values and current headers.
      const values = parts.slice(1);
      const fields: Record<string, string> = {};

      for (let i = 0; i < currentHeaders.length; i++) {
        const key = currentHeaders[i];
        if (!key) continue;
        fields[key] = values[i] ?? "";
      }

      // Also store any extra values (in case row has more columns than header).
      for (let i = currentHeaders.length; i < values.length; i++) {
        fields[`_extra_${i}`] = values[i] ?? "";
      }

      // Add record to the map. currentType could still be null if we
      // never saw a header and the inference block above did not run;
      // fall back to rowType in that case.
      const typeKey: string = currentType ?? rowType;
      if (!recordsByType.has(typeKey)) {
        recordsByType.set(typeKey, []);
      }
      recordsByType.get(typeKey)?.push({
        type: typeKey,
        fields,
      });
    }
  }

  return { recordsByType, warnings };
}

/**
 * Parse a single tab-delimited line, respecting quoted fields.
 * Quoted fields can contain tabs and newlines.
 *
 * @param line - A single line of tab-delimited text
 * @returns Array of unquoted field values
 */
function parseTabLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote ("" → ").
        current += '"';
        i++;
      } else {
        // Toggle quote state.
        inQuotes = !inQuotes;
      }
    } else if (char === "\t" && !inQuotes) {
      // End of field.
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  // Final field.
  fields.push(current);

  return fields.map((f) => f.trim()); // Trim whitespace from each field.
}

/**
 * Utility: extract a single field value from an IIF record, case-insensitive.
 */
export function getIifField(record: IifRecord, fieldName: string): string | null {
  // Direct match first.
  if (record.fields[fieldName] !== undefined) {
    return record.fields[fieldName];
  }

  // Case-insensitive match.
  const lower = fieldName.toLowerCase();
  const matched = Object.keys(record.fields).find((k) => k.toLowerCase() === lower);

  return matched ? (record.fields[matched] ?? null) : null;
}

/**
 * Stitch PO + SPL rows: given a list of IIF records, attach SPL (split) lines
 * to their parent PURCHORDR records.
 *
 * IIF format nests SPL rows immediately after their parent PURCHORDR in document order.
 * However, when records are grouped by type, we lose that order. This function uses
 * TRNSID matching to reconnect splits to their parent PO.
 *
 * @param recordsByType - Map of record type → records
 * @returns Map of PO externalId → array of SPL record fields
 */
export function stitchPoSplits(
  recordsByType: Map<string, IifRecord[]>,
): Map<string, Record<string, string>[]> {
  const poSplitMap = new Map<string, Record<string, string>[]>();
  const purchOrders = recordsByType.get("PURCHORDR") || [];
  const splits = recordsByType.get("SPL") || [];

  // Initialize map: each PO gets an empty array of splits.
  for (const po of purchOrders) {
    const poId = getIifField(po, "TRNSID") || getIifField(po, "NAME") || "";
    poSplitMap.set(poId, []);
  }

  // Assign each SPL to its parent PO by matching TRNSID field.
  for (const split of splits) {
    const trnsId = split.fields.TRNSID || "";

    // Find the PO with matching TRNSID.
    for (const po of purchOrders) {
      const poId = getIifField(po, "TRNSID") || getIifField(po, "NAME") || "";

      if (trnsId === poId) {
        poSplitMap.get(poId)?.push(split.fields);
        break;
      }
    }
  }

  return poSplitMap;
}
