"use client";

/*
 * Items cache sync — client-side bridge between the server-rendered
 * items list and the Dexie read cache.
 *
 * This component is rendered at the bottom of the items list server
 * component and receives an already-serialized snapshot as props.
 * On mount (and whenever the snapshot signature changes) it writes
 * the snapshot into IndexedDB. The component renders nothing — all
 * user-facing state lives in `<ItemsCacheBanner />`.
 *
 * Cache contract (Phase 2 S6 + Phase 3B):
 *   - The rows prop is ALWAYS the **unfiltered** inventory snapshot
 *     (`cacheItems` in `src/app/(app)/items/page.tsx`), NOT the
 *     rendered list. When the user is on `/items?status=archived`,
 *     the page runs a second unfiltered query so switching filters
 *     never shrinks what the offline viewer holds.
 *   - Therefore the cached snapshot is intentionally decoupled from
 *     whatever the user is *looking at*: they can see a filtered
 *     subset on screen while Dexie holds the full catalog behind it.
 *     The banner next to the filter chips reflects cache state, not
 *     visible-row count — that decoupling is load-bearing for the
 *     offline viewer's correctness.
 *   - `snapshotSignature` below is intentionally length-only: the
 *     unfiltered cache slice is capped at 100 rows, so `rows.length`
 *     changes only when real items are added or removed org-wide,
 *     not on filter navigation. A length collision across two
 *     renders is acceptable because the server always computes
 *     `cacheRows` fresh and the write is a replace-on-write.
 *
 * We take the snapshot as a prop rather than re-fetching from the
 * client to avoid a second round-trip on every navigation.
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
    if (lastWrittenRef.current === signature) {
      // A parent re-render produced the same signature we already
      // wrote. React's Strict Mode double-invokes effects in dev,
      // so without this guard we'd hit Dexie twice per navigation.
      // Mirrors `stock-count-cache-sync.tsx`.
      return;
    }
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
