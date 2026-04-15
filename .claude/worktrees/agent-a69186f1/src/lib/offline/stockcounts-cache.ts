/*
 * Stock-count read-cache helpers — Sprint 29 (PWA Sprint 6).
 *
 * Mirrors `items-cache.ts` in shape and intent: browser-only
 * writers/readers around the Dexie `stockCounts` + `stockCountRows`
 * tables, with a single `meta` row per (org, user) tuple for the
 * "synced X ago" indicator.
 *
 * The caching contract is intentionally **per-count, not global**:
 * visiting `/stock-counts` on its own does NOT populate the cache.
 * You have to open a specific count's detail page, and that visit
 * writes that one count's header + resolved snapshot rows into
 * Dexie via `writeStockCountDetail`. The meta row is updated on
 * every write so the list viewer can show a coherent "most recent
 * sync" stamp.
 *
 * Why per-count:
 *   - The list page is cheap to reload while online; the expensive
 *     thing is the **rows** (every item × warehouse in scope), and
 *     those are only interesting to a user who's actually about to
 *     walk that count.
 *   - A user on a shared laptop should not leak one count's scope
 *     into another count's offline view. Keying by `orgId:countId`
 *     keeps the blast radius to one session per write.
 *
 * Non-goals (PWA Sprint 7+):
 *   - Live sync of remote entries back into the cache. We only
 *     capture `entryCount` and `countedQuantity` at write time;
 *     anything added on another device after the sync is invisible
 *     until the user reloads the detail page online.
 *   - Writing entries back to Dexie. Queued entries live in the
 *     Sprint 25 `pendingOps` table — the viewer reads them from
 *     there to compute live progress.
 */

import {
  type CacheMeta,
  type CachedStockCount,
  type CachedStockCountRow,
  cacheMetaKey,
  cacheRowKey,
  getOfflineDb,
  stockCountRowKey,
} from "./db";

/**
 * Input shape for a stock-count header. Decoupled from Prisma so
 * server components can build a plain object without pulling the
 * generated client into a client bundle. The values mirror
 * `CachedStockCount` one-to-one except that `rowCount` /
 * `entryCount` / `syncedAt` are filled in by the writer.
 */
export interface StockCountSnapshotHeader {
  id: string;
  name: string;
  state: CachedStockCount["state"];
  methodology: CachedStockCount["methodology"];
  warehouseId: string | null;
  warehouseName: string | null;
  createdAt: string;
  startedAt: string | null;
  entryCount: number;
}

/**
 * Input shape for one scope row inside a cached count. All labels
 * are already resolved by the server component — the cache never
 * walks the items/warehouses tables at read time.
 */
export interface StockCountSnapshotRowInput {
  snapshotId: string;
  itemId: string;
  itemSku: string;
  itemName: string;
  itemUnit: string;
  warehouseId: string;
  warehouseName: string;
  expectedQuantity: number;
  countedQuantity: number;
}

export interface StockCountSnapshotScope {
  orgId: string;
  userId: string;
}

/**
 * Persist a fresh snapshot of one stock count.
 *
 * Semantics:
 *   1. Every `stockCountRows` row currently keyed on `countId` is
 *      deleted first. This replace-on-write strategy matches what
 *      `items-cache.ts` does: we can't tombstone rows that the
 *      server has deleted, so a full replace is the only safe
 *      option.
 *   2. The fresh rows are `bulkPut` into `stockCountRows`.
 *   3. The `stockCounts` row is `put` with the new header + the
 *      captured `rowCount` / `entryCount`.
 *   4. The shared `meta` row is updated with the new `syncedAt`
 *      timestamp and the running count of stock counts cached for
 *      this (org, user) tuple — so the list viewer can show one
 *      "synced X ago" line even though writes are per-count.
 *
 * All four steps run inside one Dexie transaction so readers never
 * see a half-written count. Returns `true` on success, `false` on
 * any IndexedDB failure (quota, transaction abort, missing DB).
 */
export async function writeStockCountDetail(
  scope: StockCountSnapshotScope,
  header: StockCountSnapshotHeader,
  rows: readonly StockCountSnapshotRowInput[],
): Promise<boolean> {
  const db = getOfflineDb();
  if (!db) return false;

  try {
    const nowIso = new Date().toISOString();
    const metaKey = cacheMetaKey(scope.orgId, scope.userId, "stockCounts");
    const cachedRows: CachedStockCountRow[] = rows.map((row) => ({
      key: stockCountRowKey(scope.orgId, header.id, row.snapshotId),
      orgId: scope.orgId,
      userId: scope.userId,
      countId: header.id,
      snapshotId: row.snapshotId,
      itemId: row.itemId,
      itemSku: row.itemSku,
      itemName: row.itemName,
      itemUnit: row.itemUnit,
      warehouseId: row.warehouseId,
      warehouseName: row.warehouseName,
      expectedQuantity: row.expectedQuantity,
      countedQuantity: row.countedQuantity,
    }));
    const cachedHeader: CachedStockCount = {
      key: cacheRowKey(scope.orgId, header.id),
      id: header.id,
      orgId: scope.orgId,
      userId: scope.userId,
      name: header.name,
      state: header.state,
      methodology: header.methodology,
      warehouseId: header.warehouseId,
      warehouseName: header.warehouseName,
      createdAt: header.createdAt,
      startedAt: header.startedAt,
      rowCount: cachedRows.length,
      entryCount: header.entryCount,
      syncedAt: nowIso,
    };

    await db.transaction("rw", db.stockCounts, db.stockCountRows, db.meta, async () => {
      // Drop every row keyed to this count so a deletion on the
      // server is visible locally after the next sync.
      await db.stockCountRows.where("countId").equals(header.id).delete();
      if (cachedRows.length > 0) {
        await db.stockCountRows.bulkPut(cachedRows);
      }
      await db.stockCounts.put(cachedHeader);

      // Running count of cached stock counts in this scope for the
      // meta row's `count` field. A `.count()` with the compound
      // index is cheap.
      const totalCached = await db.stockCounts
        .where("[orgId+userId]")
        .equals([scope.orgId, scope.userId])
        .count();
      const meta: CacheMeta = {
        key: metaKey,
        orgId: scope.orgId,
        userId: scope.userId,
        table: "stockCounts",
        syncedAt: nowIso,
        count: totalCached,
      };
      await db.meta.put(meta);
    });
    return true;
  } catch {
    return false;
  }
}

export interface StockCountListRead {
  counts: CachedStockCount[];
  syncedAt: string | null;
  count: number;
}

/**
 * Return every stock count cached for the given (org, user) tuple,
 * sorted newest-`syncedAt`-first. Matches the shape of
 * `readItemsSnapshot` — empty (not null) on missing/broken DB so
 * callers can write a single render path.
 */
export async function readStockCountList(
  scope: StockCountSnapshotScope,
): Promise<StockCountListRead> {
  const db = getOfflineDb();
  if (!db) return { counts: [], syncedAt: null, count: 0 };

  try {
    const metaKey = cacheMetaKey(scope.orgId, scope.userId, "stockCounts");
    const [meta, rawCounts] = await Promise.all([
      db.meta.get(metaKey),
      db.stockCounts.where("[orgId+userId]").equals([scope.orgId, scope.userId]).toArray(),
    ]);
    // Sort newest-sync-first. Cheap for the small N we expect
    // (tens, not thousands) per device.
    const sorted = [...rawCounts].sort((a, b) =>
      a.syncedAt < b.syncedAt ? 1 : a.syncedAt > b.syncedAt ? -1 : 0,
    );
    return {
      counts: sorted,
      syncedAt: meta?.syncedAt ?? null,
      count: meta?.count ?? sorted.length,
    };
  } catch {
    return { counts: [], syncedAt: null, count: 0 };
  }
}

export interface StockCountDetailRead {
  header: CachedStockCount | null;
  rows: CachedStockCountRow[];
}

/**
 * Return the cached header + rows for one stock count. Empty if
 * either half is missing — the viewer treats that as "not cached".
 */
export async function readStockCountDetail(
  scope: StockCountSnapshotScope,
  countId: string,
): Promise<StockCountDetailRead> {
  const db = getOfflineDb();
  if (!db) return { header: null, rows: [] };

  try {
    const headerKey = cacheRowKey(scope.orgId, countId);
    const [header, rows] = await Promise.all([
      db.stockCounts.get(headerKey),
      db.stockCountRows.where("countId").equals(countId).toArray(),
    ]);
    if (!header || header.userId !== scope.userId) {
      // Don't leak another user's cached detail to a sibling in
      // the same browser.
      return { header: null, rows: [] };
    }
    return { header, rows };
  } catch {
    return { header: null, rows: [] };
  }
}
