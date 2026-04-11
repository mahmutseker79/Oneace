"use client";

/*
 * Offline queue review — Sprint 30 (PWA Sprint 7).
 *
 * The third force-static client shell after /offline/items and
 * /offline/stock-counts. Mirrors their pattern: the server page
 * resolves every label server-side and hands down a plain object,
 * the shell reads from Dexie on mount, and no auth / cookies / DB
 * calls ever touch this component.
 *
 * Why this route exists:
 *
 *   Sprints 25–28 shipped the write queue (enqueue + runner +
 *   dispatcher registry + Background Sync relay). But the runner
 *   can only replay ops whose dispatcher returned `ok` or `retry`.
 *   An op that returns `fatal` — or an op whose opType has no
 *   dispatcher registered — is parked in the `failed` status.
 *   Before this sprint the only trace of that failure was a
 *   small red number in the header banner, with nowhere to click.
 *   This route is that click target.
 *
 * What the user can do here:
 *
 *   - See every op in the active scope grouped by status
 *     (pending, in_flight, failed). Succeeded rows are NOT
 *     listed — the runner's janitor sweeps them after 5 min and
 *     listing them would make the screen noisy.
 *   - Retry a failed op (transition status back to `pending`;
 *     the runner's foreground drain picks it up on the next
 *     `online` / `visibilitychange` event).
 *   - Discard a single failed op (hard-delete; the dispatcher
 *     already ran with the op id as an idempotency key, so
 *     deleting here never rolls back server state).
 *   - Bulk-clear every failed op in the scope (one button,
 *     confirm-prompt to prevent misclicks).
 *
 * Cross-tab safety:
 *
 *   Actions use the same Dexie transaction helpers as the runner.
 *   If two tabs click Retry simultaneously, the `requeueFailedOp`
 *   transaction only transitions a `failed` row — whichever tab
 *   writes first wins, the other gets `false`, and the UI
 *   refreshes to the new state on its next 3-second poll.
 *
 * Live updates:
 *
 *   Same poll cadence as the banner (3s) — no native Dexie event
 *   fires when a row's status changes. Sprint 31 replaces this
 *   with a real Dexie live-query subscription.
 */

import {
  CheckCircle2,
  CircleAlert,
  CloudOff,
  Inbox,
  Loader2,
  RefreshCcw,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { CachedPendingOp } from "@/lib/offline/db";
import { getOfflineDb } from "@/lib/offline/db";
import { formatSyncedAgo } from "@/lib/offline/items-cache";
import {
  type PendingOpScope,
  clearFailedOps,
  deleteOp,
  listOps,
  requeueFailedOp,
} from "@/lib/offline/queue";

/**
 * Full label bundle the server page hands to the shell. Every
 * string the view can render lives here so the force-static HTML
 * can pin English copy at build time (Sprint 30 — no client-side
 * i18n yet; request context is not available on a precached
 * response).
 */
export interface OfflineQueueViewLabels {
  title: string;
  subtitle: string;
  loading: string;
  errorTitle: string;
  errorBody: string;
  backHome: string;
  backOnline: string;
  emptyTitle: string;
  emptyBody: string;
  sectionPendingTitle: string;
  sectionPendingEmpty: string;
  sectionInFlightTitle: string;
  sectionInFlightEmpty: string;
  sectionFailedTitle: string;
  sectionFailedEmpty: string;
  columnOp: string;
  columnCreated: string;
  columnAttempts: string;
  columnStatus: string;
  columnError: string;
  columnActions: string;
  opMovementCreate: string;
  opCountEntryAdd: string;
  opUnknown: string;
  statusPending: string;
  statusInFlight: string;
  statusFailed: string;
  statusSucceeded: string;
  retryCta: string;
  discardCta: string;
  clearFailedCta: string;
  clearFailedConfirm: string;
  discardConfirm: string;
  clearedToast: string;
  retriedToast: string;
  discardedToast: string;
  retryDisabledHint: string;
  attemptCountTemplate: string;
  payloadFallback: string;
  /** Locale tag (BCP 47). English shell today; present so the
   * view can pass it to `formatSyncedAgo` without hard-coding. */
  locale: string;
}

export interface OfflineQueueShellProps {
  labels: OfflineQueueViewLabels;
}

/**
 * Thin wrapper that handles scope discovery. Like
 * `OfflineStockCountsShell`, this picks the most-recently-synced
 * `(orgId, userId)` from the `meta` table. If the browser has
 * never synced anything, we render the empty state.
 *
 * We split this out from `OfflineQueueView` so the force-static
 * page can mount a single component and not worry about the
 * async scope resolution.
 */
export function OfflineQueueShell({ labels }: OfflineQueueShellProps) {
  type ShellState =
    | { kind: "loading" }
    | { kind: "error" }
    | { kind: "empty-scope" }
    | { kind: "ready"; scope: PendingOpScope };

  const [state, setState] = useState<ShellState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const db = getOfflineDb();
      if (!db) {
        if (!cancelled) setState({ kind: "error" });
        return;
      }
      try {
        // Scope discovery mirrors `/offline/stock-counts`: pick
        // the newest syncedAt across every cached table. The
        // items snapshot is the most common one to exist, but
        // we don't require it — a user who only touched stock
        // counts still has a valid meta row.
        const metaRows = await db.meta.toArray();
        if (metaRows.length === 0) {
          // No sync yet on this device means no queue scope —
          // but there could STILL be queued ops if the user is
          // brand new and went offline before the first read
          // cache ever wrote. We fall through to an empty-scope
          // state, and the view renders an empty shell rather
          // than crashing on a missing scope.
          if (!cancelled) setState({ kind: "empty-scope" });
          return;
        }
        const [latest] = [...metaRows].sort((a, b) =>
          a.syncedAt < b.syncedAt ? 1 : a.syncedAt > b.syncedAt ? -1 : 0,
        );
        if (!latest) {
          if (!cancelled) setState({ kind: "empty-scope" });
          return;
        }
        if (!cancelled) {
          setState({
            kind: "ready",
            scope: { orgId: latest.orgId, userId: latest.userId },
          });
        }
      } catch {
        if (!cancelled) setState({ kind: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.kind === "loading") {
    return (
      <OfflineQueueFrame labels={labels}>
        <div className="rounded-lg border border-dashed border-border bg-background p-10 text-center text-sm text-muted-foreground">
          {labels.loading}
        </div>
      </OfflineQueueFrame>
    );
  }
  if (state.kind === "error") {
    return (
      <OfflineQueueFrame labels={labels}>
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-10 text-center">
          <h2 className="text-base font-medium text-destructive">{labels.errorTitle}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{labels.errorBody}</p>
        </div>
      </OfflineQueueFrame>
    );
  }
  if (state.kind === "empty-scope") {
    return (
      <OfflineQueueFrame labels={labels}>
        <OfflineQueueEmpty labels={labels} />
      </OfflineQueueFrame>
    );
  }
  return (
    <OfflineQueueFrame labels={labels}>
      <OfflineQueueView scope={state.scope} labels={labels} />
    </OfflineQueueFrame>
  );
}

/**
 * Shared page chrome — title, subtitle, back-home link at the
 * bottom. Pulled out of `OfflineQueueView` so the loading /
 * error / empty states all share the same frame without
 * duplicating JSX.
 */
function OfflineQueueFrame({
  labels,
  children,
}: {
  labels: OfflineQueueViewLabels;
  children: React.ReactNode;
}) {
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
      {children}
      <div className="mt-10 text-center">
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

function OfflineQueueEmpty({ labels }: { labels: OfflineQueueViewLabels }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-background p-10 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Inbox className="h-5 w-5 text-muted-foreground" aria-hidden />
      </div>
      <h2 className="text-base font-medium">{labels.emptyTitle}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{labels.emptyBody}</p>
    </div>
  );
}

/**
 * The main view, mounted once the shell has resolved a scope.
 * Polls Dexie every 3 seconds for pending / in_flight / failed
 * rows and renders them as three grouped sections.
 */
interface OfflineQueueViewProps {
  scope: PendingOpScope;
  labels: OfflineQueueViewLabels;
}

function OfflineQueueView({ scope, labels }: OfflineQueueViewProps) {
  const [pendingRows, setPendingRows] = useState<CachedPendingOp[]>([]);
  const [inFlightRows, setInFlightRows] = useState<CachedPendingOp[]>([]);
  const [failedRows, setFailedRows] = useState<CachedPendingOp[]>([]);
  // `toast` is a transient status row at the top of the view. We
  // intentionally don't pull in a proper toast library — one
  // ephemeral status line keeps the offline bundle tiny, and a
  // force-static route has no toast context anyway.
  const [toast, setToast] = useState<string | null>(null);
  // `busyId` flips while an action is awaiting Dexie. We disable
  // all buttons on the same row while it's true so a user can't
  // double-click retry/discard.
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [pending, inFlight, failed] = await Promise.all([
      listOps(scope, ["pending"]),
      listOps(scope, ["in_flight"]),
      listOps(scope, ["failed"]),
    ]);
    setPendingRows(pending);
    setInFlightRows(inFlight);
    setFailedRows(failed);
  }, [scope]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (cancelled) return;
      await refresh();
    };
    void run();
    const interval = window.setInterval(() => {
      void run();
    }, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
    // Action handlers force an immediate re-fetch by calling
    // `refresh()` directly in their `finally` block — no extra
    // tick dep is needed here because `refresh` closes over
    // the current scope's state setters stably.
  }, [refresh]);

  // Transient toast auto-dismiss after 4s. A ref-based timer
  // would also work but useEffect gives us clean unmount cleanup.
  useEffect(() => {
    if (!toast) return;
    const handle = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(handle);
  }, [toast]);

  const totalRows = pendingRows.length + inFlightRows.length + failedRows.length;

  const handleRetry = useCallback(
    async (op: CachedPendingOp) => {
      if (busyId) return;
      setBusyId(op.id);
      try {
        const ok = await requeueFailedOp(op.id);
        if (ok) {
          setToast(labels.retriedToast);
        }
      } finally {
        setBusyId(null);
        // Force an immediate re-read so the row visibly leaves
        // the "Failed" section instead of waiting up to 3s for
        // the next poll tick.
        await refresh();
      }
    },
    [busyId, labels.retriedToast, refresh],
  );

  const handleDiscard = useCallback(
    async (op: CachedPendingOp) => {
      if (busyId) return;
      // The `confirm` dialog is intentional — discarding a failed
      // op is user-initiated destructive and the standard browser
      // prompt is a zero-dep guard. A nicer modal can come later.
      const confirmed = window.confirm(labels.discardConfirm);
      if (!confirmed) return;
      setBusyId(op.id);
      try {
        const ok = await deleteOp(op.id);
        if (ok) {
          setToast(labels.discardedToast);
        }
      } finally {
        setBusyId(null);
        await refresh();
      }
    },
    [busyId, labels.discardConfirm, labels.discardedToast, refresh],
  );

  const handleClearAllFailed = useCallback(async () => {
    if (busyId) return;
    if (failedRows.length === 0) return;
    const confirmed = window.confirm(labels.clearFailedConfirm);
    if (!confirmed) return;
    setBusyId("__bulk__");
    try {
      const count = await clearFailedOps(scope);
      if (count > 0) {
        setToast(labels.clearedToast.replace("{count}", String(count)));
      }
    } finally {
      setBusyId(null);
      await refresh();
    }
  }, [busyId, failedRows.length, labels.clearFailedConfirm, labels.clearedToast, scope, refresh]);

  // Total-rows-zero fast-path renders the same empty state as the
  // scope-empty path. Keeps the UI consistent whether the cache is
  // missing or just quiet.
  if (totalRows === 0) {
    return <OfflineQueueEmpty labels={labels} />;
  }

  return (
    <div className="space-y-8">
      {toast ? (
        <output
          aria-live="polite"
          className="flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-700 dark:text-emerald-300"
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          <span>{toast}</span>
        </output>
      ) : null}

      <OfflineQueueSection
        title={labels.sectionPendingTitle}
        emptyBody={labels.sectionPendingEmpty}
        icon={<Loader2 className="h-4 w-4 text-muted-foreground" aria-hidden />}
        rows={pendingRows}
        labels={labels}
        busyId={busyId}
        onRetry={null}
        onDiscard={null}
      />

      <OfflineQueueSection
        title={labels.sectionInFlightTitle}
        emptyBody={labels.sectionInFlightEmpty}
        icon={<Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />}
        rows={inFlightRows}
        labels={labels}
        busyId={busyId}
        onRetry={null}
        onDiscard={null}
      />

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <TriangleAlert className="h-4 w-4 text-destructive" aria-hidden />
            {labels.sectionFailedTitle}
          </h2>
          {failedRows.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                void handleClearAllFailed();
              }}
              disabled={busyId !== null}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/5 px-3 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              {labels.clearFailedCta}
            </button>
          ) : null}
        </div>
        {failedRows.length === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-background px-4 py-6 text-center text-xs text-muted-foreground">
            {labels.sectionFailedEmpty}
          </p>
        ) : (
          <OfflineQueueTable
            rows={failedRows}
            labels={labels}
            busyId={busyId}
            onRetry={(op) => {
              void handleRetry(op);
            }}
            onDiscard={(op) => {
              void handleDiscard(op);
            }}
          />
        )}
      </section>
    </div>
  );
}

interface OfflineQueueSectionProps {
  title: string;
  emptyBody: string;
  icon: React.ReactNode;
  rows: readonly CachedPendingOp[];
  labels: OfflineQueueViewLabels;
  busyId: string | null;
  onRetry: ((op: CachedPendingOp) => void) | null;
  onDiscard: ((op: CachedPendingOp) => void) | null;
}

function OfflineQueueSection({
  title,
  emptyBody,
  icon,
  rows,
  labels,
  busyId,
  onRetry,
  onDiscard,
}: OfflineQueueSectionProps) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-background px-4 py-6 text-center text-xs text-muted-foreground">
          {emptyBody}
        </p>
      ) : (
        <OfflineQueueTable
          rows={rows}
          labels={labels}
          busyId={busyId}
          onRetry={onRetry}
          onDiscard={onDiscard}
        />
      )}
    </section>
  );
}

interface OfflineQueueTableProps {
  rows: readonly CachedPendingOp[];
  labels: OfflineQueueViewLabels;
  busyId: string | null;
  onRetry: ((op: CachedPendingOp) => void) | null;
  onDiscard: ((op: CachedPendingOp) => void) | null;
}

function OfflineQueueTable({ rows, labels, busyId, onRetry, onDiscard }: OfflineQueueTableProps) {
  // `actionsEnabled` flips the trailing "Actions" column on/off.
  // Pending and in_flight sections hide actions entirely (retry
  // is meaningless on a row the runner is about to pick up, and
  // discarding an in-flight row would race with the dispatcher).
  const actionsEnabled = onRetry !== null || onDiscard !== null;

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left font-medium">{labels.columnOp}</th>
            <th className="px-4 py-3 text-left font-medium">{labels.columnCreated}</th>
            <th className="px-4 py-3 text-right font-medium">{labels.columnAttempts}</th>
            <th className="px-4 py-3 text-left font-medium">{labels.columnStatus}</th>
            <th className="px-4 py-3 text-left font-medium">{labels.columnError}</th>
            {actionsEnabled ? (
              <th className="px-4 py-3 text-right font-medium">{labels.columnActions}</th>
            ) : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <OfflineQueueRow
              key={row.id}
              row={row}
              labels={labels}
              busy={busyId === row.id || busyId === "__bulk__"}
              onRetry={onRetry}
              onDiscard={onDiscard}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface OfflineQueueRowProps {
  row: CachedPendingOp;
  labels: OfflineQueueViewLabels;
  busy: boolean;
  onRetry: ((op: CachedPendingOp) => void) | null;
  onDiscard: ((op: CachedPendingOp) => void) | null;
}

function OfflineQueueRow({ row, labels, busy, onRetry, onDiscard }: OfflineQueueRowProps) {
  // Memoize the payload preview so toggling `busy` doesn't
  // re-serialize the (potentially large) payload on every render.
  const payloadPreview = useMemo(
    () => renderPayloadPreview(row.payload, labels),
    [row.payload, labels],
  );
  const actionsEnabled = onRetry !== null || onDiscard !== null;

  return (
    <tr className="bg-background">
      <td className="px-4 py-3 align-top">
        <div className="font-medium">{opTypeLabel(row.opType, labels)}</div>
        {payloadPreview ? (
          <div className="mt-1 line-clamp-2 font-mono text-[11px] text-muted-foreground">
            {payloadPreview}
          </div>
        ) : null}
      </td>
      <td className="px-4 py-3 align-top text-xs text-muted-foreground">
        {formatSyncedAgo(row.createdAt, labels.locale)}
      </td>
      <td className="px-4 py-3 align-top text-right tabular-nums">{row.attemptCount}</td>
      <td className="px-4 py-3 align-top">
        <StatusBadge status={row.status} labels={labels} />
      </td>
      <td className="px-4 py-3 align-top">
        {row.lastError ? (
          <div className="flex items-start gap-1.5 text-xs text-destructive">
            <CircleAlert className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden />
            <span className="break-words">{row.lastError}</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      {actionsEnabled ? (
        <td className="px-4 py-3 align-top">
          <div className="flex items-center justify-end gap-1.5">
            {onRetry ? (
              <button
                type="button"
                onClick={() => onRetry(row)}
                disabled={busy}
                className="inline-flex h-8 items-center gap-1 rounded-md border border-input bg-background px-2.5 text-xs font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCcw className="h-3 w-3" aria-hidden />
                {labels.retryCta}
              </button>
            ) : null}
            {onDiscard ? (
              <button
                type="button"
                onClick={() => onDiscard(row)}
                disabled={busy}
                className="inline-flex h-8 items-center gap-1 rounded-md border border-destructive/40 bg-destructive/5 px-2.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="h-3 w-3" aria-hidden />
                {labels.discardCta}
              </button>
            ) : null}
          </div>
        </td>
      ) : null}
    </tr>
  );
}

function StatusBadge({
  status,
  labels,
}: {
  status: CachedPendingOp["status"];
  labels: OfflineQueueViewLabels;
}) {
  if (status === "pending") {
    return (
      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
        {labels.statusPending}
      </span>
    );
  }
  if (status === "in_flight") {
    return (
      <span className="inline-flex items-center rounded-full bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-600 dark:text-sky-300">
        {labels.statusInFlight}
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
        {labels.statusFailed}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
      {labels.statusSucceeded}
    </span>
  );
}

function opTypeLabel(opType: string, labels: OfflineQueueViewLabels): string {
  // Keep the mapping inline — the dispatcher registry is the
  // source of truth for opType strings, but importing it here
  // would pull dispatcher code into the force-static bundle.
  // Duplicating the two literal strings is cheaper.
  if (opType === "movement.create") return labels.opMovementCreate;
  if (opType === "countEntry.add") return labels.opCountEntryAdd;
  return `${labels.opUnknown} (${opType})`;
}

/**
 * Produce a short, scannable payload preview. We JSON-stringify
 * the first 120 chars so the user can tell which of five
 * "Stock-count entry" rows is which (item id, quantity, etc).
 * The full payload is intentionally NOT rendered — for most ops
 * it's a small object, but a malformed or oversized payload
 * should never blow up the layout.
 */
function renderPayloadPreview(payload: unknown, labels: OfflineQueueViewLabels): string | null {
  if (payload === null || payload === undefined) return null;
  try {
    const json = JSON.stringify(payload);
    if (!json || json === "{}" || json === "[]") return null;
    const max = 120;
    return json.length > max ? `${json.slice(0, max)}…` : json;
  } catch {
    return labels.payloadFallback;
  }
}
