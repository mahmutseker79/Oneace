/*
 * Categories read-cache helpers.
 *
 * Same replace-on-write / `(orgId, userId)` scoping pattern as
 * items-cache.ts and warehouses-cache.ts. See items-cache.ts for
 * the full rationale.
 */

import { type CachedCategory, cacheMetaKey, cacheRowKey, getOfflineDb } from "./db";

export interface CategorySnapshotRow {
  id: string;
  name: string;
  parentId: string | null;
}

export interface CategorySnapshotScope {
  orgId: string;
  userId: string;
}

export async function writeCategoriesSnapshot(
  scope: CategorySnapshotScope,
  rows: readonly CategorySnapshotRow[],
): Promise<boolean> {
  const db = getOfflineDb();
  if (!db) return false;

  try {
    const nowIso = new Date().toISOString();
    const metaKey = cacheMetaKey(scope.orgId, scope.userId, "categories");
    const cachedRows: CachedCategory[] = rows.map((row) => ({
      key: cacheRowKey(scope.orgId, row.id),
      id: row.id,
      orgId: scope.orgId,
      userId: scope.userId,
      name: row.name,
      parentId: row.parentId,
    }));

    await db.transaction("rw", db.categories, db.meta, async () => {
      await db.categories
        .where("orgId")
        .equals(scope.orgId)
        .filter((row) => row.userId === scope.userId)
        .delete();
      if (cachedRows.length > 0) {
        await db.categories.bulkPut(cachedRows);
      }
      await db.meta.put({
        key: metaKey,
        orgId: scope.orgId,
        userId: scope.userId,
        table: "categories",
        syncedAt: nowIso,
        count: cachedRows.length,
      });
    });
    return true;
  } catch {
    return false;
  }
}

export interface CategoriesSnapshotRead {
  rows: CachedCategory[];
  syncedAt: string | null;
  count: number;
}

export async function readCategoriesSnapshot(
  scope: CategorySnapshotScope,
): Promise<CategoriesSnapshotRead> {
  const db = getOfflineDb();
  if (!db) return { rows: [], syncedAt: null, count: 0 };

  try {
    const metaKey = cacheMetaKey(scope.orgId, scope.userId, "categories");
    const [meta, rows] = await Promise.all([
      db.meta.get(metaKey),
      db.categories
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
