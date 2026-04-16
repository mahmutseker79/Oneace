"use client";

/*
 * Generic picklist cache sync for the two picklist tables that
 * Sprint 24 snapshots into Dexie (warehouses, categories).
 *
 * The warehouses and categories lists are small, static-ish
 * reference data. The full snapshot is cheap to serialize, so
 * unlike the items sync we just key the effect on (org, user,
 * rowCount).
 *
 * Design note: we take a `table` discriminator string instead of a
 * function-prop `writer` because client-component props are
 * serialized across the server/client boundary, and function props
 * are only supported for Server Actions. The table id is a
 * plain string, cheap to pass down, and a single source of truth
 * for which writer runs.
 *
 * This is NOT a general-purpose data sync layer. Items keeps its
 * own dedicated bridge (items-cache-sync.tsx) because its write
 * shape needs Decimal + onHand handling.
 */

import { useEffect, useRef } from "react";

import {
  type CategorySnapshotRow,
  type CategorySnapshotScope,
  writeCategoriesSnapshot,
} from "@/lib/offline/categories-cache";
import {
  type WarehouseSnapshotRow,
  type WarehouseSnapshotScope,
  writeWarehousesSnapshot,
} from "@/lib/offline/warehouses-cache";

export type PicklistCacheSyncProps =
  | {
      table: "warehouses";
      scope: WarehouseSnapshotScope;
      rows: readonly WarehouseSnapshotRow[];
    }
  | {
      table: "categories";
      scope: CategorySnapshotScope;
      rows: readonly CategorySnapshotRow[];
    };

export function PicklistCacheSync(props: PicklistCacheSyncProps) {
  const propsRef = useRef(props);

  const snapshotSignature = `${props.table}:${props.scope.orgId}:${props.scope.userId}:${props.rows.length}`;

  useEffect(() => {
    propsRef.current = props;
  }, [props]);

  useEffect(() => {
    let cancelled = false;
    const signature = snapshotSignature;
    const runWrite = () => {
      if (cancelled) return;
      const current = propsRef.current;
      // Dispatch to the correct writer based on the table
      // discriminator. The types narrow via the union so each
      // branch gets the right (scope, rows) pair.
      if (current.table === "warehouses") {
        void writeWarehousesSnapshot(current.scope, current.rows);
      } else {
        void writeCategoriesSnapshot(current.scope, current.rows);
      }
      // Reference the signature inside the effect body so the
      // static analyzer recognizes it as a real dependency.
      void signature;
    };
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    if (typeof w.requestIdleCallback === "function") {
      const handle = w.requestIdleCallback(runWrite);
      return () => {
        cancelled = true;
        if (typeof w.cancelIdleCallback === "function") {
          w.cancelIdleCallback(handle);
        }
      };
    }
    const timeout = window.setTimeout(runWrite, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [snapshotSignature]);

  return null;
}
