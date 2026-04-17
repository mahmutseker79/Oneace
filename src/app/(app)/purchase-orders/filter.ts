import { type Prisma, PurchaseOrderStatus } from "@/generated/prisma";

/**
 * URL-driven filter for /purchase-orders. Shares the shape-and-strict-
 * parse pattern that /movements uses (Sprint 14): the URL is the
 * source of truth, the server page reads it out of `searchParams`,
 * and `buildPurchaseOrderWhere` turns the parsed shape into a Prisma
 * `where`. Filters are three axes:
 *
 *   - `status` — exact match on `PurchaseOrderStatus`. Validated
 *     against `Object.values(PurchaseOrderStatus)` so a typo in the
 *     URL (or a status we removed from the enum) degrades to "no
 *     filter" rather than a 500.
 *   - `supplier` — exact match on `supplierId`. We trust it as an
 *     opaque id here; the outer query is already scoped to
 *     `organizationId`, so a cross-org id guess just returns zero
 *     rows.
 *   - `q` — case-insensitive substring match on `poNumber`. Handy
 *     for users who remember "PO-000123" without wanting to scroll
 *     a year of orders. We keep it on `poNumber` only (not notes or
 *     supplier name) so the query stays index-friendly via the
 *     existing `(organizationId, poNumber)` unique index.
 *
 * Keeping all three in this one module means the page and any
 * future CSV export can `parsePurchaseOrderFilter` the same way
 * `/movements` and `/movements/export` share `parseMovementFilter`.
 */

export type PurchaseOrderFilter = {
  status: PurchaseOrderStatus | undefined;
  supplierId: string | undefined;
  q: string;
  rawStatus: string;
  rawSupplier: string;
  rawQ: string;
};

export type PurchaseOrderSearchParams = {
  status?: string | string[];
  supplier?: string | string[];
  q?: string | string[];
};

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function parseStatus(raw: string): PurchaseOrderStatus | undefined {
  if (raw.length === 0) return undefined;
  const allowed = Object.values(PurchaseOrderStatus) as string[];
  if (allowed.includes(raw)) return raw as PurchaseOrderStatus;
  return undefined;
}

// Cheap bound: a supplier cuid is ~25 chars, we allow up to 64 to be
// safe and bail out on obviously wrong input so the `where` stays
// typesafe for Prisma.
function parseSupplierId(raw: string): string | undefined {
  if (raw.length === 0) return undefined;
  if (raw.length > 64) return undefined;
  return raw;
}

function parseQuery(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return "";
  // Cap at 64 chars so a runaway `?q=` doesn't turn into a Postgres
  // sequential scan over a 1 MB pattern.
  return trimmed.slice(0, 64);
}

export async function parsePurchaseOrderFilter(
  searchParams: Promise<PurchaseOrderSearchParams>,
): Promise<PurchaseOrderFilter> {
  const params = await searchParams;
  const rawStatus = firstParam(params.status);
  const rawSupplier = firstParam(params.supplier);
  const rawQ = firstParam(params.q);

  return {
    status: parseStatus(rawStatus),
    supplierId: parseSupplierId(rawSupplier),
    q: parseQuery(rawQ),
    rawStatus,
    rawSupplier,
    rawQ,
  };
}

export function buildPurchaseOrderWhere(
  filter: PurchaseOrderFilter,
): Prisma.PurchaseOrderWhereInput {
  const where: Prisma.PurchaseOrderWhereInput = {};
  if (filter.status) where.status = filter.status;
  if (filter.supplierId) where.supplierId = filter.supplierId;
  if (filter.q.length > 0) {
    where.poNumber = { contains: filter.q, mode: "insensitive" };
  }
  return where;
}

export function hasAnyFilter(filter: PurchaseOrderFilter): boolean {
  return Boolean(filter.status || filter.supplierId || filter.q.length > 0);
}
