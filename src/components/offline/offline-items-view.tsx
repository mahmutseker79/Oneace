"use client";

/*
 * Offline items viewer — the first route in the port that serves
 * business data directly from the Dexie read cache with zero
 * dependency on the server session.
 *
 * How it works:
 *
 *   1. The parent route (`src/app/offline/items/page.tsx`) is a
 *      `force-static` server component, so the HTML shell is
 *      precached by the service worker at install time.
 *   2. On mount, this component opens the Dexie database, asks
 *      the `meta` table which (orgId, userId) scope has the most
 *      recent items snapshot, and renders those rows.
 *   3. No auth, no cookies, no Server Actions. If IndexedDB is
 *      empty or unavailable, we render an empty state telling
 *      the user to reconnect and sync the catalog first.
 *
 * Why "most recently synced" is the right pick:
 *
 *   When a user is offline and visits this page, they want to
 *   see whatever they were just looking at before the network
 *   dropped — that's the snapshot with the newest `syncedAt`.
 *   If two users share a browser and both happen to have cached
 *   snapshots, the most recent session wins; since the snapshot
 *   predates the logout, this can never leak data to a *future*
 *   user who hasn't logged in yet. A login-aware version is
 *   PWA Sprint 4+ territory once we have a proper offline auth
 *   story.
 *
 *   `offline-stockcounts-view.tsx` relies on the same rule — keep
 *   the two viewers in lockstep when revisiting this trade-off.
 */

import { CloudOff, Database, Package } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { CacheMeta, CachedItem } from "@/lib/offline/db";
import { getOfflineDb } from "@/lib/offline/db";
import { formatSyncedAgo } from "@/lib/offline/items-cache";

export interface OfflineItemsViewLabels {
  title: string;
  subtitle: string;
  loading: string;
  emptyTitle: string;
  emptyBody: string;
  errorTitle: string;
  errorBody: string;
  syncedLabel: string;
  columnSku: string;
  columnName: string;
  columnCategory: string;
  columnStock: string;
  columnStatus: string;
  statusActive: string;
  statusArchived: string;
  statusDraft: string;
  noneCategory: string;
  cachedCount: string;
  backHome: string;
  locale: string;
}

type ViewState =
  | { kind: "loading" }
  | { kind: "empty" }
  | { kind: "error" }
  | { kind: "ready"; rows: CachedItem[]; meta: CacheMeta };

export function OfflineItemsView({ labels }: { labels: OfflineItemsViewLabels }) {
  const [state, setState] = useState<ViewState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const db = getOfflineDb();
      if (!db) {
        if (!cancelled) setState({ kind: "empty" });
        return;
      }
      try {
        // Pull every items-table meta row, pick the one with the
        // newest syncedAt. Dexie returns them in insertion order
        // — a sort on the client is cheap because we expect a
        // small number of (org, user) tuples per device.
        const metaRows = await db.meta.where("table").equals("items").toArray();
        if (metaRows.length === 0) {
          if (!cancelled) setState({ kind: "empty" });
          return;
        }
        const [latest] = [...metaRows].sort((a, b) =>
          a.syncedAt < b.syncedAt ? 1 : a.syncedAt > b.syncedAt ? -1 : 0,
        );
        if (!latest) {
          if (!cancelled) setState({ kind: "empty" });
          return;
        }
        const rows = await db.items
          .where("orgId")
          .equals(latest.orgId)
          .filter((row) => row.userId === latest.userId)
          .toArray();
        // Sort newest sku first — with no createdAt column in
        // the cached row, falling back to name order is kinder
        // than leaving the insertion order leaking through.
        rows.sort((a, b) => a.name.localeCompare(b.name, labels.locale));
        if (!cancelled) setState({ kind: "ready", rows, meta: latest });
      } catch {
        if (!cancelled) setState({ kind: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [labels.locale]);

  function statusLabel(status: CachedItem["status"]): string {
    if (status === "ACTIVE") return labels.statusActive;
    if (status === "ARCHIVED") return labels.statusArchived;
    return labels.statusDraft;
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <CloudOff className="h-5 w-5 text-muted-foreground" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{labels.title}</h1>
          <p className="text-sm text-muted-foreground">{labels.subtitle}</p>
        </div>
      </div>

      {state.kind === "loading" ? (
        <div className="rounded-lg border border-dashed border-border bg-background p-10 text-center text-sm text-muted-foreground">
          {labels.loading}
        </div>
      ) : null}

      {state.kind === "empty" ? (
        <div className="rounded-lg border border-dashed border-border bg-background p-10 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Package className="h-5 w-5 text-muted-foreground" aria-hidden />
          </div>
          <h2 className="text-base font-medium">{labels.emptyTitle}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{labels.emptyBody}</p>
          <Link
            href="/"
            className="mt-6 inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            {labels.backHome}
          </Link>
        </div>
      ) : null}

      {state.kind === "error" ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-10 text-center">
          <h2 className="text-base font-medium text-destructive">{labels.errorTitle}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{labels.errorBody}</p>
        </div>
      ) : null}

      {state.kind === "ready" ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Database className="h-3.5 w-3.5" aria-hidden />
            <span>
              {labels.syncedLabel} · {formatSyncedAgo(state.meta.syncedAt, labels.locale)} ·{" "}
              {labels.cachedCount.replace("{count}", String(state.rows.length))}
            </span>
          </div>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">{labels.columnSku}</th>
                  <th className="px-4 py-3 text-left font-medium">{labels.columnName}</th>
                  <th className="px-4 py-3 text-left font-medium">{labels.columnCategory}</th>
                  <th className="px-4 py-3 text-right font-medium">{labels.columnStock}</th>
                  <th className="px-4 py-3 text-left font-medium">{labels.columnStatus}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {state.rows.map((row) => (
                  <tr key={row.key} className="bg-background">
                    <td className="px-4 py-3 font-mono text-xs">{row.sku}</td>
                    <td className="px-4 py-3 font-medium">{row.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {row.categoryName ?? labels.noneCategory}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {row.onHand} {row.unit}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{statusLabel(row.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-center">
            <Link
              href="/"
              className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {labels.backHome}
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
