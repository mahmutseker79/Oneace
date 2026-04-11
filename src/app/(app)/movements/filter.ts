import { type Prisma, StockMovementType } from "@/generated/prisma";

/**
 * Parsed movement-filter state. Everything is optional: a request with
 * no search params means "no filter, show the recent tail".
 *
 * `from` and `to` are parsed from `YYYY-MM-DD` strings and stored as
 * Date objects pinned to the start/end of the UTC day. The UI uses
 * `<input type="date">` which always speaks YYYY-MM-DD regardless of
 * the user's locale, so we don't need to touch locale formatting here.
 *
 * `type` is a single StockMovementType value; anything else (array,
 * unknown string) falls back to `undefined` so the filter has no effect.
 */
export type MovementFilter = {
  from: Date | undefined;
  to: Date | undefined;
  type: StockMovementType | undefined;
  // Sprint 17: warehouse scope — opaque id, cross-referenced in the
  // outer org-scoped query so a cross-org guess returns zero rows.
  warehouseId: string | undefined;
  // Sprint 18: item substring search (sku / name / barcode). Empty
  // string means "no filter" so the server can treat it uniformly.
  // Capped at 64 chars so a runaway query can't bloat the SQL.
  q: string;
  // Raw trimmed strings so the filter bar can rehydrate its inputs
  // without re-reading the searchParams on the client.
  rawFrom: string;
  rawTo: string;
  rawType: string;
  rawWarehouse: string;
  rawQ: string;
};

export type MovementSearchParams = {
  from?: string | string[];
  to?: string | string[];
  type?: string | string[];
  warehouse?: string | string[];
  q?: string | string[];
};

function pickString(raw: string | string[] | undefined): string {
  if (Array.isArray(raw)) return (raw[0] ?? "").trim();
  return (raw ?? "").trim();
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parse a `YYYY-MM-DD` string to a UTC Date. Returns `undefined` for
 * anything that doesn't match the shape or represents an invalid date
 * (e.g. 2026-02-30). The parse is deliberately strict — we do NOT
 * accept the loose `new Date(string)` coercion because it silently
 * treats unrelated strings as "invalid date" and hides bugs.
 */
function parseIsoDate(value: string, endOfDay: boolean): Date | undefined {
  if (!DATE_RE.test(value)) return undefined;
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  if (endOfDay) {
    const dt = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
    if (Number.isNaN(dt.getTime())) return undefined;
    // Round-trip check so we reject things like 2026-02-30 (which JS
    // quietly normalizes to March 2).
    if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return undefined;
    return dt;
  }
  const dt = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  if (Number.isNaN(dt.getTime())) return undefined;
  if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return undefined;
  return dt;
}

function parseType(raw: string): StockMovementType | undefined {
  if (raw.length === 0) return undefined;
  // Type-safe membership check against the Prisma enum.
  const allowed = Object.values(StockMovementType) as string[];
  if (allowed.includes(raw)) return raw as StockMovementType;
  return undefined;
}

// Warehouse ids are cuids (~25 chars); we cap at 64 as a cheap
// defense so a runaway `?warehouse=` can't be stuffed into a
// Prisma equality check. The outer query is already org-scoped
// so a cross-org id guess just returns zero rows.
function parseWarehouseId(raw: string): string | undefined {
  if (raw.length === 0) return undefined;
  if (raw.length > 64) return undefined;
  return raw;
}

// Sprint 18: item substring query. Trim + 64-char cap mirrors the
// Sprint 15 PO-number filter so SKU-style strings (~20 chars) and
// name fragments both fit comfortably without letting a pathological
// URL like `?q=<10k chars>` blow up the generated SQL. Empty string
// = "no filter", which the caller treats uniformly.
function parseQuery(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return "";
  return trimmed.slice(0, 64);
}

export async function parseMovementFilter(
  searchParams: Promise<MovementSearchParams>,
): Promise<MovementFilter> {
  const params = await searchParams;
  const rawFrom = pickString(params.from);
  const rawTo = pickString(params.to);
  const rawType = pickString(params.type);
  const rawWarehouse = pickString(params.warehouse);
  const rawQ = pickString(params.q);

  return {
    from: rawFrom ? parseIsoDate(rawFrom, false) : undefined,
    to: rawTo ? parseIsoDate(rawTo, true) : undefined,
    type: parseType(rawType),
    warehouseId: parseWarehouseId(rawWarehouse),
    q: parseQuery(rawQ),
    rawFrom,
    rawTo,
    rawType,
    rawWarehouse,
    rawQ,
  };
}

/**
 * Build the Prisma `where` clause for a stock-movement query that is
 * already scoped to an organization id. The caller merges in
 * `organizationId` separately — we don't want to take it as an
 * argument here because this helper is about *user-supplied filters*,
 * not tenancy.
 *
 * Silently drops a `from > to` inversion (returns an always-false
 * match) so the user never sees a weird crash; the UI validates before
 * submit anyway, but this is a defense-in-depth belt.
 */
export function buildMovementWhere(filter: MovementFilter): Prisma.StockMovementWhereInput {
  const where: Prisma.StockMovementWhereInput = {};

  if (filter.from && filter.to && filter.from.getTime() > filter.to.getTime()) {
    // Inverted range → return a "no rows" clause by asking for an
    // impossible id. Cheaper than throwing and keeps the page rendering.
    return { id: "__inverted-range__" };
  }

  if (filter.from || filter.to) {
    where.createdAt = {
      ...(filter.from ? { gte: filter.from } : {}),
      ...(filter.to ? { lte: filter.to } : {}),
    };
  }

  if (filter.type) {
    where.type = filter.type;
  }

  if (filter.warehouseId) {
    // Match both sides of a TRANSFER so "show me everything that
    // happened in warehouse X" includes incoming transfers, not
    // just outgoing. RECEIPT/ISSUE/ADJUSTMENT only set `warehouseId`
    // so the `toWarehouseId` branch is effectively a no-op for
    // them. Prisma composes this OR under the implicit outer AND
    // so it combines cleanly with an active `type` filter.
    where.OR = [{ warehouseId: filter.warehouseId }, { toWarehouseId: filter.warehouseId }];
  }

  if (filter.q.length > 0) {
    // Relation-level OR on the referenced Item: sku / name / barcode
    // substring, case-insensitive. Living on `where.item` means it
    // does NOT clobber the top-level `where.OR` the warehouse axis
    // already uses — Prisma composes them under the implicit outer
    // AND, so a user can narrow by warehouse *and* item at the same
    // time. Using `contains` (not `startsWith`) is deliberate so a
    // partial SKU like "ABC" finds "SKU-ABC-123"; stays index-friendly
    // enough at MVP-scale (≤ ~10k items/org). Migrate to a tsvector
    // column if we ever see a single org cross 100k items.
    where.item = {
      OR: [
        { sku: { contains: filter.q, mode: "insensitive" } },
        { name: { contains: filter.q, mode: "insensitive" } },
        { barcode: { contains: filter.q, mode: "insensitive" } },
      ],
    };
  }

  return where;
}

/**
 * `true` when the user has actually applied any filter. Used to decide
 * whether to show the "Clear filters" control and tweak the empty state.
 */
export function hasAnyFilter(filter: MovementFilter): boolean {
  return Boolean(
    filter.from || filter.to || filter.type || filter.warehouseId || filter.q.length > 0,
  );
}
