/*
 * Warehouses read-cache helpers.
 *
 * Mirrors the shape of `items-cache.ts`. Warehouses are small and
 * change rarely, so every successful render of the warehouses page
 * snapshots the full list into Dexie. Same replace-on-write
 * semantics, same `(orgId, userId)` scoping. See the header comment
 * in `items-cache.ts` for the rationale behind these choices.
 *
 * PWA Sprint 3 motivation: the item detail / stock count / scan
 * flows all need the warehouse picklist to render useful offline
 * screens. Caching it here lands the substrate; the dependent UIs
 * will consume it in later sprints.
 */

import { type CachedWarehouse, cacheMetaKey, cacheRowKey, getOfflineDb } from "./db";

export interface WarehouseSnapshotRow {
  id: string;
  name: string;
  code: string;
  city: string | null;
  region: string | null;
  country: string | null;
  isDefault: boolean;
}

export interface WarehouseSnapshotScope {
  orgId: string;
  userId: string;
}

/**
 * Replace the entire warehouses snapshot for a scope. Silent no-op
 * (returns false) when IndexedDB is unavailable so the UI never
 * breaks because of a failed cache write.
 */
export async function writeWarehousesSnapshot(
  scope: WarehouseSnapshotScope,
  rows: readonly WarehouseSnapshotRow[],
): Promise<boolean> {
  const db = getOfflineDb();
  if (!db) return false;

  try {
    const nowIso = new Date().toISOString();
    const metaKey = cacheMetaKey(scope.orgId, scope.userId, "warehouses");
    const cachedRows: CachedWarehouse[] = rows.map((row) => ({
      key: cacheRowKey(scope.orgId, row.id),
      id: row.id,
      orgId: scope.orgId,
      userId: scope.userId,
      name: row.name,
      code: row.code,
      city: row.city,
      region: row.region,
      country: row.country,
      isDefault: row.isDefault,
    }));

    await db.transaction("rw", db.warehouses, db.meta, async () => {
      await db.warehouses
        .where("orgId")
        .equals(scope.orgId)
        .filter((row) => row.userId === scope.userId)
        .delete();
      if (cachedRows.length > 0) {
        await db.warehouses.bulkPut(cachedRows);
      }
      await db.meta.put({
        key: metaKey,
        orgId: scope.orgId,
        userId: scope.userId,
        table: "warehouses",
        syncedAt: nowIso,
        count: cachedRows.length,
      });
    });
    return true;
  } catch {
    return false;
  }
}

export interface WarehousesSnapshotRead {
  rows: CachedWarehouse[];
  syncedAt: string | null;
  count: number;
}

export async function readWarehousesSnapshot(
  scope: WarehouseSnapshotScope,
): Promise<WarehousesSnapshotRead> {
  const db = getOfflineDb();
  if (!db) return { rows: [], syncedAt: null, count: 0 };

  try {
    const metaKey = cacheMetaKey(scope.orgId, scope.userId, "warehouses");
    const [meta, rows] = await Promise.all([
      db.meta.get(metaKey),
      db.warehouses
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
