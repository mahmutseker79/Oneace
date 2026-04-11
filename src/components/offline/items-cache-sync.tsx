"use client";

/*
 * Items cache sync — client-side bridge between the server-rendered
 * items list and the Dexie read cache.
 *
 * This component is rendered at the bottom of the items list server
 * component and receives an already-serialized snapshot as props.
 * On mount (and whenever the snapshot identity changes) it writes
 * the snapshot into IndexedDB. The component renders nothing — all
 * user-facing state lives in `<ItemsCacheBanner />`.
 *
 * We deliberately take the snapshot as a prop rather than fetching
 * again from the client: this keeps the cache in sync with whatever
 * the user just *saw* on the server-rendered page, and avoids a
 * second round-trip on every navigation.
 */

import { useEffect, useRef } from "react";

import {
  type ItemSnapshotRow,
  type ItemSnapshotScope,
  writeItemsSnapshot,
} from "@/lib/offline/items-cache";

export interface ItemsCacheSyncProps {
  scope: ItemSnapshotScope;
  rows: readonly ItemSnapshotRow[];
}

export function ItemsCacheSync({ scope, rows }: ItemsCacheSyncProps) {
  // Refs always hold the latest props without forcing the effect
  // to re-run on every parent render. Biome/react-hooks knows that
  // ref reads are not reactive, so listing them in the dep array
  // would be incorrect — we intentionally key the effect on the
  // stable signature string below.
  const scopeRef = useRef(scope);
  const rowsRef = useRef(rows);
  const lastWrittenRef = useRef<string | null>(null);
  scopeRef.current = scope;
  rowsRef.current = rows;

  // Signature changes whenever the snapshot the user is looking at
  // changes: either the active org/user switched, or the rendered
  // row count changed. This is conservative — a reorder with the
  // same count would not rewrite the cache — which is fine because
  // the items page renders newest-first and any mutation shows up
  // as an added/removed row or a fresh server navigation.
  const snapshotSignature = `${scope.orgId}:${scope.userId}:${rows.length}`;

  useEffect(() => {
    let cancelled = false;
    // Reference the signature inside the effect so the static
    // analyzer sees it as a real dependency and the idle callback
    // closes over the stable tag used for the last-written check.
    const signature = snapshotSignature;
    // Defer the write to idle time so it never competes with
    // hydration work. requestIdleCallback isn't available in
    // Safari, so we fall back to a short setTimeout — both are
    // fine because this is a pure background write.
    const runWrite = () => {
      if (cancelled) return;
      // The scope/rows refs always hold the latest props so the
      // snapshot we persist matches whatever the user is looking
      // at right now, not whatever was current when this effect
      // first ran.
      void writeItemsSnapshot(scopeRef.current, rowsRef.current);
      lastWrittenRef.current = signature;
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
