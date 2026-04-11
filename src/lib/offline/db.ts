/*
 * OneAce offline database — Sprint 23 (PWA Sprint 2).
 *
 * This is a Dexie-backed IndexedDB wrapper for the *read* side of the
 * offline experience. Scope of this sprint:
 *
 *   - Cache the items picklist so the item catalog survives a reload
 *     while offline.
 *   - Cache metadata (last sync timestamp, source org id, source user
 *     id) so the UI can tell the user how fresh the snapshot is and
 *     so we never leak data between orgs/users.
 *
 * Explicit non-goals (deferred to later PWA sprints):
 *
 *   - Write queue: mutations still go through Server Actions. If the
 *     network is down the action throws and the UI surfaces the
 *     failure. No background retry, no conflict resolution.
 *   - Cross-tab coordination beyond what Dexie already gives us.
 *   - Migrations past v1: the schema is intentionally minimal so the
 *     first schema bump is the easy case.
 *   - Auth-aware encryption. The IndexedDB store sits next to other
 *     tabs' data and is cleared when the org scope changes; we do not
 *     pretend it's a secure secrets store.
 *
 * Scoping contract:
 *
 *   Every record that lands in a domain table (items, warehouses,
 *   categories) MUST carry `orgId` + `userId` alongside the business
 *   columns. A sync operation reads the current
 *   (orgId, userId) tuple from the meta table and, if it differs
 *   from the snapshot being written, it wipes the tables first. This
 *   prevents stale data from one login bleeding into another — a
 *   real risk with shared laptops and multi-org users.
 *
 * Client-only:
 *
 *   IndexedDB only exists in the browser, so every call to
 *   `getOfflineDb()` is guarded against SSR. The server build must
 *   never import Dexie — that would pull ~60kb of browser-only code
 *   into the RSC graph.
 */

import Dexie, { type Table } from "dexie";

/** Schema version — bump whenever the stores or indexes change. */
export const OFFLINE_DB_VERSION = 1;

/** The single top-level DB name. One database per origin, not per org. */
export const OFFLINE_DB_NAME = "oneace-offline";

/**
 * A single items row in the offline cache. This is a narrowed subset
 * of the full Prisma Item — we intentionally drop columns the UI does
 * not render on the items list (BOM pointers, audit rows, long
 * descriptions) to keep the snapshot small and fast to serialize.
 */
export interface CachedItem {
  /** Composite key: `${orgId}:${id}` so Dexie's bulkPut can dedupe. */
  key: string;
  /** The Prisma item id. */
  id: string;
  /** Scoping — always set to the snapshot's org. */
  orgId: string;
  /** Scoping — always set to the snapshot's user. */
  userId: string;
  sku: string;
  barcode: string | null;
  name: string;
  unit: string;
  status: "ACTIVE" | "ARCHIVED" | "DRAFT";
  categoryId: string | null;
  categoryName: string | null;
  /** Sale price serialized as a string to avoid Decimal precision loss. */
  salePrice: string | null;
  currency: string;
  /** Sum of stock levels across all warehouses at snapshot time. */
  onHand: number;
}

/**
 * Cached warehouse row. Warehouses are tiny so we keep the full set.
 */
export interface CachedWarehouse {
  key: string;
  id: string;
  orgId: string;
  userId: string;
  name: string;
  /** Short code identifier — non-nullable per the Prisma schema. */
  code: string;
  city: string | null;
  region: string | null;
  country: string | null;
  isDefault: boolean;
}

/**
 * Cached category row.
 */
export interface CachedCategory {
  key: string;
  id: string;
  orgId: string;
  userId: string;
  name: string;
  parentId: string | null;
}

/**
 * Meta row — there is exactly one per (table, orgId, userId) tuple.
 * `syncedAt` is written as an ISO string so Dexie serializes it
 * deterministically across browser Date implementations.
 */
export interface CacheMeta {
  /** Composite key: `${orgId}:${userId}:${table}`. */
  key: string;
  orgId: string;
  userId: string;
  /** Which domain table this meta row describes. */
  table: "items" | "warehouses" | "categories";
  /** ISO timestamp of the last successful snapshot write. */
  syncedAt: string;
  /** Number of records captured in that snapshot. */
  count: number;
}

/**
 * The Dexie subclass. Declared once at module scope (so it's a
 * singleton across dynamic imports) but only constructed lazily so
 * the server bundle can import the types without touching indexedDB.
 */
class OneaceOfflineDb extends Dexie {
  items!: Table<CachedItem, string>;
  warehouses!: Table<CachedWarehouse, string>;
  categories!: Table<CachedCategory, string>;
  meta!: Table<CacheMeta, string>;

  constructor() {
    super(OFFLINE_DB_NAME);
    // NOTE: when bumping OFFLINE_DB_VERSION, append a `.version(N)`
    // block here with the new stores + an `.upgrade()` callback.
    // Never edit a previous version in place.
    this.version(OFFLINE_DB_VERSION).stores({
      // Dexie store declaration: primary key first, then secondary
      // indexes. We index `orgId` on every table so scope-switching
      // clears are O(index lookup) rather than a full scan.
      items: "key, orgId, userId, status, categoryId",
      warehouses: "key, orgId, userId",
      categories: "key, orgId, userId, parentId",
      meta: "key, [orgId+userId+table]",
    });
  }
}

/**
 * Module-level singleton. A second call returns the same instance,
 * which keeps Dexie's cross-instance coordination happy.
 */
let dbInstance: OneaceOfflineDb | null = null;

/**
 * Returns the Dexie database or null if the environment has no
 * IndexedDB (SSR, old browsers, private-mode Firefox in certain
 * configurations). Callers are expected to no-op on null.
 */
export function getOfflineDb(): OneaceOfflineDb | null {
  if (typeof window === "undefined") return null;
  if (typeof indexedDB === "undefined") return null;
  if (!dbInstance) {
    try {
      dbInstance = new OneaceOfflineDb();
    } catch {
      // A construction failure means IndexedDB is unavailable (e.g.
      // quota=0 in an incognito tab). Swallow and return null — the
      // calling UI will treat it as "not cached" and keep working.
      return null;
    }
  }
  return dbInstance;
}

/**
 * Build the composite key used by the domain tables. Kept in one
 * place so snapshot writers and readers never drift.
 */
export function cacheRowKey(orgId: string, id: string): string {
  return `${orgId}:${id}`;
}

/**
 * Build the composite key used by the meta table. Keyed on user as
 * well as org so two users sharing a browser never see each other's
 * sync metadata.
 */
export function cacheMetaKey(orgId: string, userId: string, table: CacheMeta["table"]): string {
  return `${orgId}:${userId}:${table}`;
}
