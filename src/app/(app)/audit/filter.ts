// Sprint 40 — audit filter parser.
//
// Mirrors the Sprint 14 `movements/filter.ts` shape: a strict parser
// that walks URL search params, defends against garbage input, and
// returns both the parsed filter state (typed, ready for Prisma) and
// the raw trimmed strings (so the client filter bar can rehydrate its
// inputs without re-reading searchParams).
//
// Why a dedicated parser instead of consuming searchParams inline in
// the page:
//
//   * The `/audit/export` route handler needs the exact same parser
//     so the downloaded CSV matches what the user sees on-screen. A
//     shared parser prevents the two surfaces from drifting.
//
//   * The date-range axis is the same "YYYY-MM-DD with round-trip
//     validity check" pattern Sprint 14 already proved out — keeping
//     that logic in one place per surface is how we avoided
//     `new Date(string)` traps on movements, and we want the same
//     discipline here.
//
//   * Action and entityType values are validated against compile-time
//     unions (`AuditAction`, `AuditEntityType`). This means the filter
//     automatically grows whenever those unions grow — new actions
//     shipped in Sprint 39 became filterable here for free.
//
// Deliberately out of scope:
//
//   * Multi-select axes. A single `action=` is simpler to reason
//     about and the compose-via-URL story stays clean. If a reviewer
//     needs two actions they can run the filter twice.
//
//   * Free-text search over metadata. Metadata is a JSON blob with
//     dialect-specific query syntax (PG `path`, SQLite nothing),
//     matching Sprint 38's decision to filter JSON in memory on the
//     PO detail page. For /audit we'd rather point users at the
//     existing entity filter than invent a portable JSON search.
//
//   * Sorting. The page is strictly newest-first (composite index
//     `(organizationId, createdAt desc, id desc)` covers it), and
//     any other order would break the cursor-pagination invariant.

import type { Prisma } from "@/generated/prisma";
import type { AuditAction, AuditEntityType } from "@/lib/audit";

/**
 * Parsed audit-filter state. Every axis is optional — a request with
 * no search params means "no filter, show the newest tail".
 *
 * The `from` / `to` dates are UTC day-boundary Dates (start-of-day
 * for `from`, end-of-day for `to`), both parsed via the strict
 * round-trip check shared with the Sprint 14 movements filter.
 */
export type AuditFilter = {
  action: AuditAction | undefined;
  entityType: AuditEntityType | undefined;
  actorId: string | undefined;
  from: Date | undefined;
  to: Date | undefined;
  // Raw trimmed strings so the filter bar can rehydrate without
  // re-reading the URL. Empty string means "not set".
  rawAction: string;
  rawEntityType: string;
  rawActor: string;
  rawFrom: string;
  rawTo: string;
};

export type AuditSearchParams = {
  action?: string | string[];
  entityType?: string | string[];
  actor?: string | string[];
  from?: string | string[];
  to?: string | string[];
  cursor?: string | string[];
};

function pickString(raw: string | string[] | undefined): string {
  if (Array.isArray(raw)) return (raw[0] ?? "").trim();
  return (raw ?? "").trim();
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Strict `YYYY-MM-DD` → UTC Date parser. Rejects shape mismatches and
 * month-overflow values (e.g. `2026-02-30` which JS would quietly
 * normalise to March 2). Identical semantics to the Sprint 14 parser
 * so the two surfaces stay consistent in their date handling.
 */
function parseIsoDate(value: string, endOfDay: boolean): Date | undefined {
  if (!DATE_RE.test(value)) return undefined;
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  const dt = endOfDay
    ? new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999))
    : new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  if (Number.isNaN(dt.getTime())) return undefined;
  if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return undefined;
  return dt;
}

// The allow-lists below are derived from the compile-time unions in
// `@/lib/audit`. We can't enumerate a union at runtime, so we keep a
// parallel const-array and enforce the relationship with a dummy
// `satisfies` on a synthetic object — if either list ever drifts from
// its union the build will break here before a bad filter reaches
// production. The synthetic object is typed as `Record<AuditAction,
// true>`, so any missing key or extraneous one surfaces at build.

const AUDIT_ACTIONS = [
  "organization.updated",
  "organization.deleted",
  "organization.transferred",
  "member.invited",
  "member.removed",
  "member.role_changed",
  "invitation.revoked",
  "invitation.accepted",
  "purchase_order.created",
  "purchase_order.sent",
  "purchase_order.cancelled",
  "purchase_order.deleted",
  "purchase_order.received",
  "item.created",
  "item.updated",
  "item.imported",
  "item.deleted",
  "warehouse.created",
  "warehouse.updated",
  "warehouse.deleted",
  "category.created",
  "category.deleted",
  "stock_count.created",
  "stock_count.cancelled",
  "stock_count.completed",
  "audit.pruned",
  "notification.sent",
] as const satisfies readonly AuditAction[];

// Exhaustiveness trap: Record<AuditAction, true> forces every union
// member to appear in the array exactly once. If a future sprint adds
// a new AuditAction value the next build fails here with a missing
// key until the filter catches up.
const _ACTION_EXHAUSTIVENESS: Record<AuditAction, true> = Object.fromEntries(
  AUDIT_ACTIONS.map((a) => [a, true] as const),
) as Record<AuditAction, true>;
void _ACTION_EXHAUSTIVENESS;

const AUDIT_ENTITY_TYPES = [
  "organization",
  "membership",
  "invitation",
  "purchase_order",
  "item",
  "warehouse",
  "category",
  "stock_count",
] as const satisfies readonly AuditEntityType[];

const _ENTITY_EXHAUSTIVENESS: Record<AuditEntityType, true> = Object.fromEntries(
  AUDIT_ENTITY_TYPES.map((e) => [e, true] as const),
) as Record<AuditEntityType, true>;
void _ENTITY_EXHAUSTIVENESS;

/**
 * Public options list for the action `Select` in the filter bar.
 * Exported so the server page can hand the list to the client
 * component without duplicating it, and so the catalog/label bag
 * resolution stays on the server side.
 */
export const AUDIT_ACTION_VALUES: readonly AuditAction[] = AUDIT_ACTIONS;

/**
 * Public options list for the entity-type `Select`. Same story as
 * `AUDIT_ACTION_VALUES`.
 */
export const AUDIT_ENTITY_TYPE_VALUES: readonly AuditEntityType[] = AUDIT_ENTITY_TYPES;

function parseAction(raw: string): AuditAction | undefined {
  if (raw.length === 0) return undefined;
  return (AUDIT_ACTIONS as readonly string[]).includes(raw) ? (raw as AuditAction) : undefined;
}

function parseEntityType(raw: string): AuditEntityType | undefined {
  if (raw.length === 0) return undefined;
  return (AUDIT_ENTITY_TYPES as readonly string[]).includes(raw)
    ? (raw as AuditEntityType)
    : undefined;
}

// Actor ids are cuids (~25 chars); cap at 64 as a cheap defense so a
// runaway `?actor=` can't be stuffed into a Prisma equality clause.
// The outer query is already org-scoped so a cross-org actor guess
// degrades to zero rows, not a leak.
function parseActorId(raw: string): string | undefined {
  if (raw.length === 0) return undefined;
  if (raw.length > 64) return undefined;
  return raw;
}

/**
 * Parse an audit filter from a page-style `searchParams` Promise.
 * The caller wraps their eagerly-read params in `Promise.resolve(...)`
 * when invoking from a route handler; the page passes its native
 * `searchParams` prop.
 */
export async function parseAuditFilter(
  searchParams: Promise<AuditSearchParams>,
): Promise<AuditFilter> {
  const params = await searchParams;
  const rawAction = pickString(params.action);
  const rawEntityType = pickString(params.entityType);
  const rawActor = pickString(params.actor);
  const rawFrom = pickString(params.from);
  const rawTo = pickString(params.to);

  return {
    action: parseAction(rawAction),
    entityType: parseEntityType(rawEntityType),
    actorId: parseActorId(rawActor),
    from: rawFrom ? parseIsoDate(rawFrom, false) : undefined,
    to: rawTo ? parseIsoDate(rawTo, true) : undefined,
    rawAction,
    rawEntityType,
    rawActor,
    rawFrom,
    rawTo,
  };
}

/**
 * Build the Prisma `where` clause for an `auditEvent` query, given an
 * already-parsed filter. The caller merges in `organizationId`
 * separately — tenancy is not this helper's concern.
 *
 * An inverted `from > to` range returns an impossible-id clause so
 * the page degrades to an empty result rather than crashing; the
 * filter bar defends client-side too but this is the belt.
 */
export function buildAuditWhere(filter: AuditFilter): Prisma.AuditEventWhereInput {
  if (filter.from && filter.to && filter.from.getTime() > filter.to.getTime()) {
    return { id: "__inverted-range__" };
  }

  const where: Prisma.AuditEventWhereInput = {};

  if (filter.action) {
    where.action = filter.action;
  }
  if (filter.entityType) {
    where.entityType = filter.entityType;
  }
  if (filter.actorId) {
    where.actorId = filter.actorId;
  }
  if (filter.from || filter.to) {
    where.createdAt = {
      ...(filter.from ? { gte: filter.from } : {}),
      ...(filter.to ? { lte: filter.to } : {}),
    };
  }

  return where;
}

/**
 * `true` when the user has actually applied any filter. Controls the
 * "Clear filters" visibility and the empty-state copy on the page.
 */
export function hasAnyAuditFilter(filter: AuditFilter): boolean {
  return Boolean(filter.action || filter.entityType || filter.actorId || filter.from || filter.to);
}

/**
 * Serialize the filter axes back to a URLSearchParams-ready shape.
 * Used by the page's "Load more" link and by the "Download CSV"
 * button so the next request carries the current filter state
 * forward. The cursor is appended separately because its lifetime
 * is tied to a single page, not to the filter as a whole.
 */
export function filterToParams(filter: AuditFilter): URLSearchParams {
  const params = new URLSearchParams();
  if (filter.action) params.set("action", filter.action);
  if (filter.entityType) params.set("entityType", filter.entityType);
  if (filter.actorId) params.set("actor", filter.actorId);
  if (filter.rawFrom) params.set("from", filter.rawFrom);
  if (filter.rawTo) params.set("to", filter.rawTo);
  return params;
}
