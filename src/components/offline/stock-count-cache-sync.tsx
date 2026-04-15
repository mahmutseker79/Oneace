"use client";

/*
 * Stock-count cache sync — Sprint 29 (PWA Sprint 6).
 *
 * Drop-in mirror of `items-cache-sync.tsx` for stock-count detail
 * pages. When the server component at `/stock-counts/[id]` renders,
 * it assembles a serialized snapshot of the count (header +
 * resolved scope rows) and passes it to this client component.
 * On mount (and whenever the snapshot signature changes) the
 * component writes the snapshot into Dexie via
 * `writeStockCountDetail`.
 *
 * The component renders nothing — a dedicated user-facing banner
 * can be added in a later sprint if needed.
 *
 * Why take the snapshot as a prop instead of fetching again on
 * the client: the server page already loaded this data for its own
 * render. Re-fetching on mount would double the round-trip and
 * risk a drift between what the user sees and what the cache
 * persists.
 */

import { useEffect, useRef } from "react";

import {
  type StockCountSnapshotHeader,
  type StockCountSnapshotRowInput,
  type StockCountSnapshotScope,
  writeStockCountDetail,
} from "@/lib/offline/stockcounts-cache";

export interface StockCountCacheSyncProps {
  scope: StockCountSnapshotScope;
  header: StockCountSnapshotHeader;
  rows: readonly StockCountSnapshotRowInput[];
}

export function StockCountCacheSync({ scope, header, rows }: StockCountCacheSyncProps) {
  // Refs always hold the latest props without forcing the effect
  // to re-run on every parent render. Dexie writes are cheap but
  // we still key the effect on a stable signature so React's
  // exhaustive-deps lint is happy without lying about reactivity.
  const scopeRef = useRef(scope);
  const headerRef = useRef(header);
  const rowsRef = useRef(rows);
  scopeRef.current = scope;
  headerRef.current = header;
  rowsRef.current = rows;

  // Holds the last signature we successfully wrote. Using a ref
  // (not state) keeps the dedupe entirely out of the React render
  // cycle — a write that "shouldn't have happened" is cheap but
  // pointless, so we skip it. Mirrors items-cache-sync.
  const lastWrittenRef = useRef<string | null>(null);

  // Signature changes on:
  //   - scope switch (different user / org)
  //   - a different count being shown (different id)
  //   - a state transition (OPEN → IN_PROGRESS → COMPLETED → ...)
  //   - row count change (a scope row added or removed)
  //   - entry count change (reconcile progress)
  //   - warehouse reassignment (header.warehouseId) — surfaced in the
  //     offline viewer's location byline
  //   - rename (header.name) — surfaced in the offline viewer header
  // These are the only things the offline viewer renders, so
  // re-writing on any other change would be wasted work. warehouseId
  // and name are included directly (not a length fingerprint) so a
  // rename or warehouse swap is detected unambiguously.
  const snapshotSignature = `${scope.orgId}:${scope.userId}:${header.id}:${header.state}:${rows.length}:${header.entryCount}:${header.warehouseId ?? ""}:${header.name ?? ""}`;

  useEffect(() => {
    let cancelled = false;
    // Close over the signature so the idle callback can write it
    // back into the dedupe ref on success. Referencing the value
    // inside the effect also satisfies biome's exhaustive-deps
    // rule without `// biome-ignore`.
    const signature = snapshotSignature;
    if (lastWrittenRef.current === signature) {
      // A parent re-render produced the same signature we already
      // wrote. React's Strict Mode double-invokes effects in dev,
      // so without this guard we'd hit Dexie twice per navigation.
      return;
    }
    const runWrite = () => {
      if (cancelled) return;
      // The write is fire-and-forget — any IndexedDB failure is
      // swallowed inside writeStockCountDetail.
      void writeStockCountDetail(scopeRef.current, headerRef.current, rowsRef.current);
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
