/**
 * Phase S6 — Flexible date parsing for competitor migrations.
 *
 * Handles various date formats across different export systems:
 * - ISO 8601 (2024-12-31)
 * - US format (12/31/2024 or MM/DD/YYYY)
 * - EU format (31/12/2024 or DD/MM/YYYY)
 * - EU period separator (31.12.2024)
 *
 * Returns null on failure. Warns if the same column has inconsistent
 * format patterns across rows.
 */

/**
 * Parse a date string in multiple formats.
 *
 * Tries in order: ISO 8601 → MM/DD/YYYY → DD/MM/YYYY → DD.MM.YYYY → YYYY-MM-DD
 * Returns an ISO 8601 string on success, null on failure.
 *
 * @param input - Raw date string from CSV
 * @returns ISO 8601 string or null if unparseable
 */
export function parseDateFlexible(input: string | null | undefined): string | null {
  if (!input || typeof input !== "string") return null;

  const trimmed = input.trim();
  if (!trimmed) return null;

  // Try ISO 8601 first (YYYY-MM-DD).
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      const d = new Date(`${year}-${month}-${day}T00:00:00Z`);
      if (!isNaN(d.getTime())) {
        return d.toISOString().split("T")[0];
      }
    }
  }

  // Try US format (MM/DD/YYYY).
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(trimmed)) {
    const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (match) {
      let [, m, d, y] = match;
      const year = parseInt(y, 10);
      const yearFull = y.length === 2 ? (year > 30 ? 1900 + year : 2000 + year) : year;
      const month = parseInt(m, 10);
      const day = parseInt(d, 10);

      // Heuristic: if day <= 12 and month <= 12, we can't be sure. Prefer MM/DD (US).
      // If day > 12, it's definitely DD/MM. If month > 12, it's definitely MM/DD.
      if (month > 12) {
        // Not valid MM/DD, skip.
      } else if (day > 12) {
        // Must be DD/MM, swap.
        const dateObj = new Date(yearFull, day - 1, month, 0, 0, 0);
        if (!isNaN(dateObj.getTime())) {
          return dateObj.toISOString().split("T")[0];
        }
      } else {
        // Ambiguous; treat as MM/DD (US default).
        const dateObj = new Date(yearFull, month - 1, day, 0, 0, 0);
        if (!isNaN(dateObj.getTime())) {
          return dateObj.toISOString().split("T")[0];
        }
      }
    }
  }

  // Try EU format with period (DD.MM.YYYY).
  if (/^\d{1,2}\.\d{1,2}\.\d{2,4}$/.test(trimmed)) {
    const match = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
    if (match) {
      let [, d, m, y] = match;
      const year = parseInt(y, 10);
      const yearFull = y.length === 2 ? (year > 30 ? 1900 + year : 2000 + year) : year;
      const month = parseInt(m, 10);
      const day = parseInt(d, 10);

      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const dateObj = new Date(yearFull, month - 1, day, 0, 0, 0);
        if (!isNaN(dateObj.getTime())) {
          return dateObj.toISOString().split("T")[0];
        }
      }
    }
  }

  // Try DD/MM/YYYY explicitly (with additional heuristic).
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(trimmed)) {
    const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (match) {
      let [, possibleDay, possibleMonth, y] = match;
      const year = parseInt(y, 10);
      const yearFull = y.length === 2 ? (year > 30 ? 1900 + year : 2000 + year) : year;

      // Try DD/MM interpretation if month > 12 or day is clearly larger.
      const d = parseInt(possibleDay, 10);
      const m = parseInt(possibleMonth, 10);

      if (d > 12 && m <= 12) {
        const dateObj = new Date(yearFull, m - 1, d, 0, 0, 0);
        if (!isNaN(dateObj.getTime())) {
          return dateObj.toISOString().split("T")[0];
        }
      }
    }
  }

  return null;
}

/**
 * Track date format consistency across a column.
 * Returns the dominant format pattern and a warning if inconsistent.
 *
 * @param values - Array of date strings from a single column
 * @returns Object with dominant format and inconsistency flag
 */
export function analyzeColumnDateFormats(
  values: (string | null | undefined)[],
): {
  dominantFormat: string | null;
  isInconsistent: boolean;
  count: { iso8601: number; slashFormat: number; periodFormat: number; unparseable: number };
} {
  const count = { iso8601: 0, slashFormat: 0, periodFormat: 0, unparseable: 0 };

  for (const v of values) {
    if (!v || typeof v !== "string") continue;

    const trimmed = v.trim();
    if (!trimmed) continue;

    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      count.iso8601++;
    } else if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(trimmed)) {
      count.slashFormat++;
    } else if (/^\d{1,2}\.\d{1,2}\.\d{2,4}$/.test(trimmed)) {
      count.periodFormat++;
    } else {
      count.unparseable++;
    }
  }

  const total =
    count.iso8601 + count.slashFormat + count.periodFormat + count.unparseable;
  if (total === 0) return { dominantFormat: null, isInconsistent: false, count };

  let dominantFormat: string | null = null;
  let dominantCount = 0;

  if (count.iso8601 > dominantCount) {
    dominantFormat = "ISO8601";
    dominantCount = count.iso8601;
  }
  if (count.slashFormat > dominantCount) {
    dominantFormat = "SLASH";
    dominantCount = count.slashFormat;
  }
  if (count.periodFormat > dominantCount) {
    dominantFormat = "PERIOD";
    dominantCount = count.periodFormat;
  }

  // Inconsistent if the dominant format is not at least 80% of the total.
  const isInconsistent = dominantCount < total * 0.8;

  return { dominantFormat, isInconsistent, count };
}
