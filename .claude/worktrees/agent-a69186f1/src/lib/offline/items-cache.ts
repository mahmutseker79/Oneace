/*
 * Items read-cache helpers.
 *
 * All functions here are browser-only (they touch IndexedDB via
 * Dexie). Callers must either:
 *
 *   (a) only invoke them from "use client" components, or
 *   (b) invoke them inside a useEffect / event handler so the code
 *       path never runs during SSR.
 *
 * Every write goes through `writeItemsSnapshot`, which is
 * idempotent: calling it twice with the same snapshot is cheap and
 * safe. Every read goes through `readItemsSnapshot`, which returns
 * both the rows and the meta row so the caller can show a "synced
 * X min ago" indicator.
 *
 * We do NOT merge snapshots — a write is always a replace for the
 * (orgId, userId) scope. Partial updates would let stale rows
 * linger after a server-side delete, and we don't yet track
 * tombstones. Replace-on-write is correct until we have a proper
 * sync protocol (PWA Sprint 4+).
 */

import { type CacheMeta, type CachedItem, cacheMetaKey, cacheRowKey, getOfflineDb } from "./db";

/**
 * Input shape for a single item snapshot row. This is deliberately
 * decoupled from Prisma's type so server components can build a
 * plain object without pulling the generated client into a client
 * bundle.
 */
export interface ItemSnapshotRow {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  unit: string;
  status: "ACTIVE" | "ARCHIVED" | "DRAFT";
  categoryId: string | null;
  categoryName: string | null;
  salePrice: string | null;
  currency: string;
  onHand: number;
}

export interface ItemSnapshotScope {
  orgId: string;
  userId: string;
}

/**
 * Write a fresh snapshot of the items list for a given scope.
 *
 * Semantics:
 *   1. If the existing meta row for this (org, user) names a
 *      different scope, the whole items table is cleared for that
 *      stale scope first. (In practice the meta key already pins
 *      the scope, so we only clear the rows we are about to
 *      overwrite — see the `where("orgId").equals()` filter.)
 *   2. All rows for the current scope are deleted.
 *   3. The new rows are bulkPut in one transaction alongside an
 *      updated meta row so readers never see a torn snapshot.
 *
 * Returns `true` if the write succeeded, `false` if IndexedDB is
 * unavailable or any step threw. A `false` return is never fatal —
 * the UI stays fully functional, it just means this pageview did
 * not contribute to the offline cache.
 */
export async function writeItemsSnapshot(
  scope: ItemSnapshotScope,
  rows: readonly ItemSnapshotRow[],
): Promise<boolean> {
  const db = getOfflineDb();
  if (!db) return false;

  try {
    const nowIso = new Date().toISOString();
    const metaKey = cacheMetaKey(scope.orgId, scope.userId, "items");
    const cachedRows: CachedItem[] = rows.map((row) => ({
      key: cacheRowKey(scope.orgId, row.id),
      id: row.id,
      orgId: scope.orgId,
      userId: scope.userId,
      sku: row.sku,
      barcode: row.barcode,
      name: row.name,
      unit: row.unit,
      status: row.status,
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      salePrice: row.salePrice,
      currency: row.currency,
      onHand: row.onHand,
    }));
    const meta: CacheMeta = {
      key: metaKey,
      orgId: scope.orgId,
      userId: scope.userId,
      table: "items",
      syncedAt: nowIso,
      count: cachedRows.length,
    };

    await db.transaction("rw", db.items, db.meta, async () => {
      // Drop every row that belongs to this (org, user) tuple. We
      // key on `orgId` via the index; the narrower userId filter
      // runs in-memory on the candidates. In practice every row
      // for an orgId belongs to the same userId on a given device
      // unless two users share a browser, which is exactly the
      // edge case we want to clean up.
      await db.items
        .where("orgId")
        .equals(scope.orgId)
        .filter((row) => row.userId === scope.userId)
        .delete();
      if (cachedRows.length > 0) {
        await db.items.bulkPut(cachedRows);
      }
      await db.meta.put(meta);
    });
    return true;
  } catch {
    // IndexedDB quota, transaction aborted, etc. Swallow — the UI
    // must not break because caching failed.
    return false;
  }
}

export interface ItemsSnapshotRead {
  rows: CachedItem[];
  syncedAt: string | null;
  count: number;
}

/**
 * Read the current snapshot for a scope. Returns an empty result
 * (not null) when the cache is empty or unavailable so call sites
 * can write a single render path without null-checks everywhere.
 */
export async function readItemsSnapshot(scope: ItemSnapshotScope): Promise<ItemsSnapshotRead> {
  const db = getOfflineDb();
  if (!db) return { rows: [], syncedAt: null, count: 0 };

  try {
    const metaKey = cacheMetaKey(scope.orgId, scope.userId, "items");
    const [meta, rows] = await Promise.all([
      db.meta.get(metaKey),
      db.items
        .where("orgId")
        .equals(scope.orgId)
        .filter((row) => row.userId === scope.userId)
        .toArray(),
    ]);
    return {
      rows,
      syncedAt: meta?.syncedAt ?? null,
      count: meta?.count ?? rows.length,
    };
  } catch {
    return { rows: [], syncedAt: null, count: 0 };
  }
}

/**
 * Format an ISO timestamp into a short "2 min ago" string using
 * Intl.RelativeTimeFormat. Falls back to the raw date string if
 * RelativeTimeFormat is unavailable (old browsers). The
 * `locale` argument comes from the user's active locale so the
 * output matches the rest of the UI.
 */
export function formatSyncedAgo(
  isoTimestamp: string,
  locale: string,
  now: Date = new Date(),
): string {
  const then = new Date(isoTimestamp);
  const diffSeconds = Math.round((then.getTime() - now.getTime()) / 1000);
  try {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    const absSeconds = Math.abs(diffSeconds);
    if (absSeconds < 60) return rtf.format(diffSeconds, "second");
    const diffMinutes = Math.round(diffSeconds / 60);
    if (Math.abs(diffMinutes) < 60) return rtf.format(diffMinutes, "minute");
    const diffHours = Math.round(diffMinutes / 60);
    if (Math.abs(diffHours) < 24) return rtf.format(diffHours, "hour");
    const diffDays = Math.round(diffHours / 24);
    return rtf.format(diffDays, "day");
  } catch {
    return then.toLocaleString(locale);
  }
}
