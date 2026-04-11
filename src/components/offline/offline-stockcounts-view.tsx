"use client";

/*
 * Offline stock-counts viewer — Sprint 29 (PWA Sprint 6).
 *
 * Mirrors `offline-items-view.tsx` in shape and intent:
 *   - The parent route (`src/app/offline/stock-counts/page.tsx`) is
 *     `force-static`, so the HTML shell is precached by the service
 *     worker at install time. This component is the first thing that
 *     runs on a cold-start offline navigation to the route.
 *   - On mount, we open Dexie, pick the (orgId, userId) tuple with
 *     the newest `stockCounts`-table meta row, and render that scope's
 *     cached counts. If a `?id=` query param is present and the
 *     caller holds that count, we render the detail view instead.
 *   - Zero auth, zero cookies, zero Server Actions.
 *
 * Why pick "most recent sync" instead of an explicit session check:
 *   matches the items viewer pattern. The cache predates any logout
 *   so a future user won't see data that wasn't there when the tab
 *   was last online. Shared-browser edge cases are deferred to the
 *   login-aware offline auth story (PWA Sprint 9+).
 *
 * The detail view is intentionally simple:
 *   - Blind / double-blind counts hide the expected column, same
 *     as the online detail page.
 *   - The cached `countedQuantity` is point-in-time — anything the
 *     user queues locally after the sync is handled by the pendingOps
 *     runner (Sprint 27), not by this viewer. We DON'T reach into the
 *     pending queue here because the reconcile path needs a single
 *     source of truth, and that source is the server once online.
 */

import { ArrowLeft, CloudOff, Database, ListChecks } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { CachedStockCount, CachedStockCountRow } from "@/lib/offline/db";
import { getOfflineDb } from "@/lib/offline/db";
import { formatSyncedAgo } from "@/lib/offline/items-cache";

export interface OfflineStockCountsViewLabels {
  // Shell
  title: string;
  subtitle: string;
  loading: string;
  errorTitle: string;
  errorBody: string;
  backHome: string;
  // List
  emptyTitle: string;
  emptyBody: string;
  syncedLabel: string;
  cachedCount: string;
  listColumnName: string;
  listColumnState: string;
  listColumnRows: string;
  listColumnEntries: string;
  listColumnSynced: string;
  // State badges (one per stock-count machine state)
  stateOpen: string;
  stateInProgress: string;
  stateCompleted: string;
  stateCancelled: string;
  // Methodology row label (show methodology + warehouse name under title)
  methodologyCycle: string;
  methodologyFull: string;
  methodologySpot: string;
  methodologyBlind: string;
  methodologyDoubleBlind: string;
  methodologyDirected: string;
  // Detail view
  detailBackToList: string;
  detailBlindBanner: string;
  detailEmpty: string;
  detailNotFound: string;
  detailProgress: string;
  detailColumnSku: string;
  detailColumnItem: string;
  detailColumnWarehouse: string;
  detailColumnExpected: string;
  detailColumnCounted: string;
  detailColumnVariance: string;
  // i18n locale used for relative time + localeCompare
  locale: string;
}

type ListState =
  | { kind: "loading" }
  | { kind: "empty" }
  | { kind: "error" }
  | { kind: "ready"; counts: CachedStockCount[]; syncedAt: string | null };

type DetailState =
  | { kind: "loading" }
  | { kind: "not_found" }
  | { kind: "error" }
  | { kind: "ready"; header: CachedStockCount; rows: CachedStockCountRow[] };

export interface OfflineStockCountsShellProps {
  labels: OfflineStockCountsViewLabels;
}

/**
 * Top-level shell: reads the `?id=` query string from the browser
 * on mount and flips between list and detail views. We can't use
 * Next's `searchParams` prop here because the parent page is
 * `force-static` — the whole point is that one prerendered HTML
 * shell services every query string.
 *
 * Listens to `popstate` so clicking the back button after a detail
 * navigation flips the view back to the list without a full reload.
 */
export function OfflineStockCountsShell({ labels }: OfflineStockCountsShellProps) {
  const [selectedCountId, setSelectedCountId] = useState<string | null>(null);

  useEffect(() => {
    const read = () => {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get("id");
      setSelectedCountId(raw && raw.length > 0 ? raw : null);
    };
    read();
    window.addEventListener("popstate", read);
    return () => {
      window.removeEventListener("popstate", read);
    };
  }, []);

  return <OfflineStockCountsView labels={labels} selectedCountId={selectedCountId} />;
}

interface OfflineStockCountsViewProps {
  labels: OfflineStockCountsViewLabels;
  /** Optional query-string count id. When set, the detail view is
   * rendered for that count; otherwise the list view is rendered. */
  selectedCountId: string | null;
}

function OfflineStockCountsView({ labels, selectedCountId }: OfflineStockCountsViewProps) {
  // The list is cheap to load — do it once on mount and keep it
  // mounted even while the detail view is shown so going back is
  // instantaneous. `scope` captures the (org, user) tuple the list
  // view picked so the detail query is guaranteed to be in the same
  // scope as the one that's displayed.
  const [listState, setListState] = useState<ListState>({ kind: "loading" });
  const [activeScope, setActiveScope] = useState<{ orgId: string; userId: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const db = getOfflineDb();
      if (!db) {
        if (!cancelled) setListState({ kind: "empty" });
        return;
      }
      try {
        // Pull every stockCounts meta row, pick the newest syncedAt.
        // Mirrors the items viewer's "most recent scope wins" rule.
        const metaRows = await db.meta.where("table").equals("stockCounts").toArray();
        if (metaRows.length === 0) {
          if (!cancelled) setListState({ kind: "empty" });
          return;
        }
        const [latest] = [...metaRows].sort((a, b) =>
          a.syncedAt < b.syncedAt ? 1 : a.syncedAt > b.syncedAt ? -1 : 0,
        );
        if (!latest) {
          if (!cancelled) setListState({ kind: "empty" });
          return;
        }
        const counts = await db.stockCounts
          .where("[orgId+userId]")
          .equals([latest.orgId, latest.userId])
          .toArray();
        if (counts.length === 0) {
          if (!cancelled) {
            setActiveScope({ orgId: latest.orgId, userId: latest.userId });
            setListState({ kind: "empty" });
          }
          return;
        }
        // Sort newest sync first so the user sees whatever they
        // touched most recently at the top. No createdAt-based
        // fallback — `syncedAt` is a monotonic string.
        const sorted = [...counts].sort((a, b) =>
          a.syncedAt < b.syncedAt ? 1 : a.syncedAt > b.syncedAt ? -1 : 0,
        );
        if (!cancelled) {
          setActiveScope({ orgId: latest.orgId, userId: latest.userId });
          setListState({ kind: "ready", counts: sorted, syncedAt: latest.syncedAt });
        }
      } catch {
        if (!cancelled) setListState({ kind: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

      {listState.kind === "loading" ? (
        <div className="rounded-lg border border-dashed border-border bg-background p-10 text-center text-sm text-muted-foreground">
          {labels.loading}
        </div>
      ) : null}

      {listState.kind === "error" ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-10 text-center">
          <h2 className="text-base font-medium text-destructive">{labels.errorTitle}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{labels.errorBody}</p>
        </div>
      ) : null}

      {listState.kind === "empty" ? (
        <div className="rounded-lg border border-dashed border-border bg-background p-10 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <ListChecks className="h-5 w-5 text-muted-foreground" aria-hidden />
          </div>
          <h2 className="text-base font-medium">{labels.emptyTitle}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{labels.emptyBody}</p>
          <a
            href="/"
            className="mt-6 inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            {labels.backHome}
          </a>
        </div>
      ) : null}

      {listState.kind === "ready" && activeScope ? (
        selectedCountId ? (
          <OfflineStockCountDetail labels={labels} scope={activeScope} countId={selectedCountId} />
        ) : (
          <OfflineStockCountList
            labels={labels}
            counts={listState.counts}
            syncedAt={listState.syncedAt}
          />
        )
      ) : null}
    </div>
  );
}

function methodologyLabel(
  methodology: CachedStockCount["methodology"],
  labels: OfflineStockCountsViewLabels,
): string {
  switch (methodology) {
    case "CYCLE":
      return labels.methodologyCycle;
    case "FULL":
      return labels.methodologyFull;
    case "SPOT":
      return labels.methodologySpot;
    case "BLIND":
      return labels.methodologyBlind;
    case "DOUBLE_BLIND":
      return labels.methodologyDoubleBlind;
    case "DIRECTED":
      return labels.methodologyDirected;
  }
}

function stateLabel(
  state: CachedStockCount["state"],
  labels: OfflineStockCountsViewLabels,
): string {
  switch (state) {
    case "OPEN":
      return labels.stateOpen;
    case "IN_PROGRESS":
      return labels.stateInProgress;
    case "COMPLETED":
      return labels.stateCompleted;
    case "CANCELLED":
      return labels.stateCancelled;
  }
}

function stateClassName(state: CachedStockCount["state"]): string {
  // Plain class-name helper so the list/detail views pick the same
  // pill style. Keeping this out of Tailwind's arbitrary-value soup
  // lets biome's formatter keep stable output.
  switch (state) {
    case "OPEN":
      return "border border-border bg-background text-foreground";
    case "IN_PROGRESS":
      return "bg-amber-600 text-white";
    case "COMPLETED":
      return "bg-emerald-600 text-white";
    case "CANCELLED":
      return "bg-muted text-muted-foreground";
  }
}

function OfflineStockCountList({
  labels,
  counts,
  syncedAt,
}: {
  labels: OfflineStockCountsViewLabels;
  counts: CachedStockCount[];
  syncedAt: string | null;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Database className="h-3.5 w-3.5" aria-hidden />
        <span>
          {labels.syncedLabel}
          {syncedAt ? ` · ${formatSyncedAgo(syncedAt, labels.locale)}` : ""} ·{" "}
          {labels.cachedCount.replace("{count}", String(counts.length))}
        </span>
      </div>
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">{labels.listColumnName}</th>
              <th className="px-4 py-3 text-left font-medium">{labels.listColumnState}</th>
              <th className="px-4 py-3 text-right font-medium">{labels.listColumnRows}</th>
              <th className="px-4 py-3 text-right font-medium">{labels.listColumnEntries}</th>
              <th className="px-4 py-3 text-left font-medium">{labels.listColumnSynced}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {counts.map((count) => (
              <tr key={count.key} className="bg-background">
                <td className="px-4 py-3">
                  {/* Plain anchor instead of next/link so the static
                      shell does not ship an extra router RSC payload
                      to the service-worker-cached HTML. A full
                      navigation is fine here — the route is already
                      precached. */}
                  <a
                    href={`/offline/stock-counts?id=${encodeURIComponent(count.id)}`}
                    className="font-medium hover:underline"
                  >
                    {count.name}
                  </a>
                  <div className="text-xs text-muted-foreground">
                    {methodologyLabel(count.methodology, labels)}
                    {count.warehouseName ? ` · ${count.warehouseName}` : ""}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${stateClassName(count.state)}`}
                  >
                    {stateLabel(count.state, labels)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{count.rowCount}</td>
                <td className="px-4 py-3 text-right tabular-nums">{count.entryCount}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {formatSyncedAgo(count.syncedAt, labels.locale)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-center">
        <a
          href="/"
          className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          {labels.backHome}
        </a>
      </div>
    </div>
  );
}

function OfflineStockCountDetail({
  labels,
  scope,
  countId,
}: {
  labels: OfflineStockCountsViewLabels;
  scope: { orgId: string; userId: string };
  countId: string;
}) {
  const [state, setState] = useState<DetailState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const db = getOfflineDb();
      if (!db) {
        if (!cancelled) setState({ kind: "not_found" });
        return;
      }
      try {
        const headerKey = `${scope.orgId}:${countId}`;
        const header = await db.stockCounts.get(headerKey);
        if (!header || header.userId !== scope.userId) {
          // Defensive: the read-helper does the same filter — we
          // repeat it here so the "leak to wrong user" bug cannot
          // sneak in via a direct key lookup.
          if (!cancelled) setState({ kind: "not_found" });
          return;
        }
        const rows = await db.stockCountRows.where("countId").equals(countId).toArray();
        // Stable order by item name so the detail view reads like
        // a deterministic checklist. The scope-row snapshot has no
        // natural order beyond Prisma insertion, which is fine
        // server-side but jarring here.
        rows.sort((a, b) => a.itemName.localeCompare(b.itemName, labels.locale));
        if (!cancelled) setState({ kind: "ready", header, rows });
      } catch {
        if (!cancelled) setState({ kind: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scope.orgId, scope.userId, countId, labels.locale]);

  const isBlind = useMemo(() => {
    if (state.kind !== "ready") return false;
    return state.header.methodology === "BLIND" || state.header.methodology === "DOUBLE_BLIND";
  }, [state]);

  if (state.kind === "loading") {
    return (
      <div className="rounded-lg border border-dashed border-border bg-background p-10 text-center text-sm text-muted-foreground">
        {labels.loading}
      </div>
    );
  }
  if (state.kind === "error") {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-10 text-center">
        <h2 className="text-base font-medium text-destructive">{labels.errorTitle}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{labels.errorBody}</p>
      </div>
    );
  }
  if (state.kind === "not_found") {
    return (
      <div className="space-y-4">
        <a
          href="/offline/stock-counts"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {labels.detailBackToList}
        </a>
        <div className="rounded-lg border border-dashed border-border bg-background p-10 text-center">
          <h2 className="text-base font-medium">{labels.detailNotFound}</h2>
        </div>
      </div>
    );
  }

  const { header, rows } = state;
  // Progress is (rows with countedQuantity > 0) / rowCount. Matches
  // the online detail page's implicit "how many scope rows have
  // received at least one entry" definition without needing to
  // reach into the variance helper.
  const rowsCounted = rows.reduce((acc, row) => (row.countedQuantity > 0 ? acc + 1 : acc), 0);

  return (
    <div className="space-y-5">
      <a
        href="/offline/stock-counts"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {labels.detailBackToList}
      </a>

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold">{header.name}</h2>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${stateClassName(header.state)}`}
            >
              {stateLabel(header.state, labels)}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {methodologyLabel(header.methodology, labels)}
            {header.warehouseName ? ` · ${header.warehouseName}` : ""}
          </p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <div>
            {labels.syncedLabel} · {formatSyncedAgo(header.syncedAt, labels.locale)}
          </div>
          <div className="mt-1 tabular-nums">
            {labels.detailProgress
              .replace("{counted}", String(rowsCounted))
              .replace("{total}", String(header.rowCount))
              .replace("{entries}", String(header.entryCount))}
          </div>
        </div>
      </div>

      {isBlind ? (
        <output className="block rounded-md border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm">
          {labels.detailBlindBanner}
        </output>
      ) : null}

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-background p-10 text-center text-sm text-muted-foreground">
          {labels.detailEmpty}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">{labels.detailColumnSku}</th>
                <th className="px-4 py-3 text-left font-medium">{labels.detailColumnItem}</th>
                <th className="px-4 py-3 text-left font-medium">{labels.detailColumnWarehouse}</th>
                {isBlind ? null : (
                  <th className="px-4 py-3 text-right font-medium">
                    {labels.detailColumnExpected}
                  </th>
                )}
                <th className="px-4 py-3 text-right font-medium">{labels.detailColumnCounted}</th>
                {isBlind ? null : (
                  <th className="px-4 py-3 text-right font-medium">
                    {labels.detailColumnVariance}
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => {
                const variance = row.countedQuantity - row.expectedQuantity;
                const varianceClass =
                  variance > 0
                    ? "text-emerald-600"
                    : variance < 0
                      ? "text-destructive"
                      : "text-muted-foreground";
                return (
                  <tr key={row.key} className="bg-background">
                    <td className="px-4 py-3 font-mono text-xs">{row.itemSku}</td>
                    <td className="px-4 py-3 font-medium">{row.itemName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.warehouseName}</td>
                    {isBlind ? null : (
                      <td className="px-4 py-3 text-right tabular-nums">{row.expectedQuantity}</td>
                    )}
                    <td className="px-4 py-3 text-right tabular-nums">{row.countedQuantity}</td>
                    {isBlind ? null : (
                      <td className={`px-4 py-3 text-right tabular-nums ${varianceClass}`}>
                        {variance > 0 ? "+" : ""}
                        {variance}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
