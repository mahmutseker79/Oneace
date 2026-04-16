import { ArrowLeft, ClipboardCheck, Info } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StockCountCacheSync } from "@/components/offline/stock-count-cache-sync";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusTimeline } from "@/components/ui/status-timeline";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/lib/db";
import { getMessages, getRegion } from "@/lib/i18n";
import type {
  StockCountSnapshotHeader,
  StockCountSnapshotRowInput,
} from "@/lib/offline/stockcounts-cache";
import { requireActiveMembership } from "@/lib/session";
import { canAddEntry, canCancel, canReconcile } from "@/lib/stockcount/machine";
import { type VarianceStatus, calculateVariances } from "@/lib/stockcount/variance";

import { CancelDialog, type CancelDialogLabels } from "./cancel-dialog";
import { type BinOption, EntryForm, type EntryFormLabels, type ScopeOption } from "./entry-form";

// Phase 6.8 — entry log pagination.
const ENTRY_PAGE_SIZE = 50;

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ entryCursor?: string }>;
};

type CountState = "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
type Methodology = "CYCLE" | "FULL" | "SPOT" | "BLIND" | "DOUBLE_BLIND" | "DIRECTED";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.stockCounts.metaTitle };
}

export default async function StockCountDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { entryCursor } = (await searchParams) ?? {};
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();
  const region = await getRegion();

  const count = await db.stockCount.findFirst({
    where: { id, organizationId: membership.organizationId },
    include: {
      warehouse: { select: { id: true, name: true, code: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      // CountSnapshot stores itemId/warehouseId as plain strings, no
      // relations — we resolve item/warehouse labels in bulk below so
      // the page query plan stays flat and predictable.
      snapshots: {
        orderBy: { createdAt: "asc" },
      },
      entries: {
        orderBy: { countedAt: "desc" },
        // Phase 6.8 — cursor-based pagination for the entry log.
        take: ENTRY_PAGE_SIZE + 1,
        ...(entryCursor ? { cursor: { id: entryCursor }, skip: 1 } : {}),
      },
    },
  });

  if (!count) {
    notFound();
  }

  // Variance + the offline cache payload MUST see every entry on this
  // count, not just the 100 newest rows rendered in the entry log. The
  // `count.entries` include above is capped for render, so we issue a
  // separate unbounded fetch that returns only the columns variance
  // math needs. This keeps the live preview and the offline snapshot
  // byte-for-byte identical with what `completeStockCountAction` will
  // post on reconcile.
  const fullEntries = await db.countEntry.findMany({
    where: { countId: count.id, organizationId: membership.organizationId },
    select: {
      itemId: true,
      warehouseId: true,
      binId: true,
      countedQuantity: true,
    },
  });

  // Resolve item and warehouse labels for snapshots + entries in a pair
  // of bulk fetches — cheaper than includes per row and keeps the page
  // query plan predictable.
  const itemIds = Array.from(
    new Set([...count.snapshots.map((s) => s.itemId), ...count.entries.map((e) => e.itemId)]),
  );
  const warehouseIds = Array.from(
    new Set([
      ...count.snapshots.map((s) => s.warehouseId),
      ...count.entries.map((e) => e.warehouseId),
    ]),
  );
  const userIds = Array.from(
    new Set(
      count.entries
        .map((e) => e.countedByUserId)
        .filter((v): v is string => v !== null && v !== undefined),
    ),
  );

  const [items, warehouses, users, binsRaw] = await Promise.all([
    itemIds.length > 0
      ? db.item.findMany({
          where: {
            id: { in: itemIds },
            organizationId: membership.organizationId,
          },
          select: { id: true, sku: true, name: true, unit: true },
        })
      : Promise.resolve([]),
    warehouseIds.length > 0
      ? db.warehouse.findMany({
          where: {
            id: { in: warehouseIds },
            organizationId: membership.organizationId,
          },
          select: { id: true, name: true, code: true },
        })
      : Promise.resolve([]),
    userIds.length > 0
      ? db.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true },
        })
      : Promise.resolve([]),
    // Fetch bins for all warehouses in scope so the entry form can
    // offer a bin selector when the chosen warehouse has bins.
    warehouseIds.length > 0
      ? db.bin.findMany({
          where: {
            warehouseId: { in: warehouseIds },
            isArchived: false,
          },
          select: { id: true, warehouseId: true, code: true, label: true },
          orderBy: { code: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const itemById = new Map(items.map((item) => [item.id, item]));
  const warehouseById = new Map(warehouses.map((w) => [w.id, w]));
  const userById = new Map(users.map((u) => [u.id, u]));
  const binById = new Map(binsRaw.map((b) => [b.id, b]));

  // Bin options for the entry form selector.
  const binOptions: BinOption[] = binsRaw.map((b) => ({
    id: b.id,
    warehouseId: b.warehouseId,
    label: b.label ? `${b.code} — ${b.label}` : b.code,
  }));

  const dateFormatter = new Intl.DateTimeFormat(region.numberLocale, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const state = count.state as CountState;
  const methodology = count.methodology as Methodology;
  const isBlind = methodology === "BLIND" || methodology === "DOUBLE_BLIND";
  const isReadOnly = state === "COMPLETED" || state === "CANCELLED";

  // Variance rows are computed via the SAME pure function the server
  // reconcile action uses, so what the user sees here is exactly what
  // will be posted to the ledger on complete. We feed `fullEntries`
  // (unbounded) — not `count.entries` (capped at 100 for the entry
  // log) — so the preview agrees with the canonical server reconcile.
  const varianceRows = calculateVariances(
    count.snapshots.map((s) => ({
      itemId: s.itemId,
      warehouseId: s.warehouseId,
      expectedQuantity: s.expectedQuantity,
    })),
    fullEntries,
  );

  const scopeRows: ScopeOption[] = count.snapshots.map((snapshot) => {
    const item = itemById.get(snapshot.itemId);
    const warehouse = warehouseById.get(snapshot.warehouseId);
    return {
      itemId: snapshot.itemId,
      warehouseId: snapshot.warehouseId,
      itemLabel: item ? `${item.sku} — ${item.name}` : snapshot.itemId,
      warehouseLabel: warehouse ? `${warehouse.name} · ${warehouse.code}` : snapshot.warehouseId,
    };
  });

  // Sprint 29: build an offline-cacheable snapshot of this count
  // and hand it to <StockCountCacheSync /> below. The header +
  // resolved rows here are plain serializable values so Next can
  // pass them across the server/client boundary without fanning
  // out another query at render time. We piggy-back on the bulk
  // lookups (items/warehouses) that the page already ran for its
  // own render, so the cache write costs nothing extra on the
  // server side.
  const offlineHeader: StockCountSnapshotHeader = {
    id: count.id,
    name: count.name,
    state,
    methodology,
    warehouseId: count.warehouse?.id ?? null,
    warehouseName: count.warehouse?.name ?? null,
    createdAt: count.createdAt.toISOString(),
    startedAt: count.startedAt ? count.startedAt.toISOString() : null,
    // `entryCount` is load-bearing for the cache-sync signature in
    // `stock-count-cache-sync.tsx` — a change here flips the
    // snapshotSignature and triggers a rewrite. Keep it sourced from
    // `fullEntries.length` (unbounded) so reconcile progress in a
    // sibling tab invalidates the cache on the next render.
    entryCount: fullEntries.length,
  };
  // Sum entries per (itemId, warehouseId) so each snapshot row
  // carries its current counted quantity. Uses the same variance
  // rows the render below uses — no extra walk over `count.entries`.
  const countedByScope = new Map<string, number>();
  for (const variance of varianceRows) {
    countedByScope.set(`${variance.itemId}:${variance.warehouseId}`, variance.countedQuantity);
  }
  // Phase 6.8 — detect next page for entry log.
  const hasMoreEntries = count.entries.length > ENTRY_PAGE_SIZE;
  const visibleEntries = hasMoreEntries ? count.entries.slice(0, ENTRY_PAGE_SIZE) : count.entries;
  const nextEntryCursor = hasMoreEntries ? visibleEntries[visibleEntries.length - 1]?.id : null;

  const offlineRows: StockCountSnapshotRowInput[] = count.snapshots.map((snapshot) => {
    const item = itemById.get(snapshot.itemId);
    const warehouse = warehouseById.get(snapshot.warehouseId);
    return {
      snapshotId: snapshot.id,
      itemId: snapshot.itemId,
      itemSku: item?.sku ?? snapshot.itemId,
      itemName: item?.name ?? snapshot.itemId,
      itemUnit: item?.unit ?? "",
      warehouseId: snapshot.warehouseId,
      warehouseName: warehouse?.name ?? snapshot.warehouseId,
      expectedQuantity: snapshot.expectedQuantity,
      countedQuantity: countedByScope.get(`${snapshot.itemId}:${snapshot.warehouseId}`) ?? 0,
    };
  });

  const entryFormLabels: EntryFormLabels = {
    heading: t.stockCounts.detail.addEntryHeading,
    item: t.stockCounts.detail.addEntryItem,
    itemPlaceholder: t.stockCounts.detail.addEntryItemPlaceholder,
    warehouse: t.stockCounts.detail.addEntryWarehouse,
    warehousePlaceholder: t.stockCounts.detail.addEntryWarehousePlaceholder,
    bin: t.stockCounts.detail.addEntryBin,
    binPlaceholder: t.stockCounts.detail.addEntryBinPlaceholder,
    binNone: t.stockCounts.detail.addEntryBinNone,
    quantity: t.stockCounts.detail.addEntryQuantity,
    note: t.stockCounts.detail.addEntryNote,
    notePlaceholder: t.stockCounts.detail.addEntryNotePlaceholder,
    submit: t.stockCounts.detail.addEntrySubmit,
    submittingLabel: t.stockCounts.offlineSubmitting,
    queuedLabel: t.stockCounts.offlineQueued,
    error: t.stockCounts.errors.entryFailed,
  };

  const cancelDialogLabels: CancelDialogLabels = {
    trigger: t.stockCounts.detail.cancelAction,
    title: t.stockCounts.detail.cancelDialogTitle,
    body: t.stockCounts.detail.cancelDialogBody,
    placeholder: t.stockCounts.detail.cancelDialogPlaceholder,
    confirm: t.stockCounts.detail.cancelDialogConfirm,
    keep: t.stockCounts.detail.cancelDialogKeep,
    genericError: t.stockCounts.errors.cancelFailed,
  };

  function stateBadge(s: CountState) {
    const label = t.stockCounts.statusBadge[s];
    if (s === "OPEN") return <Badge variant="outline">{label}</Badge>;
    if (s === "IN_PROGRESS") return <Badge className="bg-amber-600">{label}</Badge>;
    if (s === "COMPLETED") return <Badge className="bg-emerald-600">{label}</Badge>;
    return <Badge variant="secondary">{label}</Badge>;
  }

  function varianceBadge(status: VarianceStatus) {
    if (status === "match") return <Badge variant="outline">{t.stockCounts.variance.match}</Badge>;
    if (status === "within_tolerance")
      return <Badge variant="secondary">{t.stockCounts.variance.withinTolerance}</Badge>;
    if (status === "over")
      return <Badge className="bg-emerald-600">{t.stockCounts.variance.over}</Badge>;
    return <Badge variant="destructive">{t.stockCounts.variance.under}</Badge>;
  }

  return (
    <div className="space-y-6">
      {/* Sprint 29: write this count's header + resolved rows into
          Dexie so /offline/stock-counts can resume it after a drop.
          Renders null — no layout impact. */}
      <StockCountCacheSync
        scope={{ orgId: membership.organizationId, userId: session.user.id }}
        header={offlineHeader}
        rows={offlineRows}
      />

      {/* God-Mode Design: PageHeader with breadcrumb + StatusTimeline */}
      <PageHeader
        title={count.name}
        description={`${t.stockCounts.methodology[methodology]}${count.warehouse ? ` · ${count.warehouse.name}` : ""}`}
        backHref="/stock-counts"
        badge={stateBadge(state)}
        breadcrumb={[
          { label: t.nav?.counts ?? "Stock Counts", href: "/stock-counts" },
          { label: count.name },
        ]}
      />

      {/* God-Mode Design: Visual workflow step indicator */}
      <StatusTimeline
        steps={[
          { label: "Create", completed: true },
          {
            label: "Count",
            completed: state !== "OPEN",
            active: state === "OPEN" || state === "IN_PROGRESS",
          },
          {
            label: "Reconcile",
            completed: state === "COMPLETED" || state === "CANCELLED",
            active: state === "IN_PROGRESS",
          },
          { label: "Approve", completed: state === "COMPLETED", active: state === "IN_PROGRESS" },
        ]}
        className="mb-2"
      />

      {/* Action cluster */}
      <div className="flex items-center gap-2">
        {canCancel(state) ? <CancelDialog countId={count.id} labels={cancelDialogLabels} /> : null}
        {canReconcile(state) ? (
          <Button size="sm" asChild>
            <Link href={`/stock-counts/${count.id}/reconcile`}>
              <ClipboardCheck className="h-4 w-4" />
              {t.stockCounts.detail.reconcileAction}
            </Link>
          </Button>
        ) : null}
      </div>

      {/* Phase 3 — progress indicator (only for IN_PROGRESS counts with snapshots) */}
      {state === "IN_PROGRESS" && count.snapshots.length > 0
        ? (() => {
            const snapshotCount = count.snapshots.length;
            // A snapshot row is "counted" if at least one entry exists for that
            // (itemId, warehouseId) pair. Use fullEntries for unbounded accuracy.
            const countedPairs = new Set(fullEntries.map((e) => `${e.itemId}::${e.warehouseId}`));
            const snapshotPairs = count.snapshots.map((s) => `${s.itemId}::${s.warehouseId}`);
            const countedCount = snapshotPairs.filter((p) => countedPairs.has(p)).length;
            const pct = Math.round((countedCount / snapshotCount) * 100);
            return (
              <div className="space-y-1.5 rounded-md border bg-muted/20 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Count progress</span>
                  <span className="tabular-nums text-muted-foreground">
                    {countedCount} / {snapshotCount} items &mdash; {pct}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full transition-all ${pct === 100 ? "bg-emerald-500" : "bg-primary"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })()
        : null}

      {/* Metadata card */}
      <Card>
        <CardContent className="grid gap-4 pt-6 text-sm md:grid-cols-2 lg:grid-cols-3">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t.stockCounts.detail.metaState}</span>
            <span>{t.stockCounts.statusBadge[state]}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t.stockCounts.detail.metaMethodology}</span>
            <span>{t.stockCounts.methodology[methodology]}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t.stockCounts.detail.metaCreated}</span>
            <span className="whitespace-nowrap">{dateFormatter.format(count.createdAt)}</span>
          </div>
          {count.startedAt ? (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t.stockCounts.detail.metaStarted}</span>
              <span className="whitespace-nowrap">{dateFormatter.format(count.startedAt)}</span>
            </div>
          ) : null}
          {count.completedAt ? (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t.stockCounts.detail.metaCompleted}</span>
              <span className="whitespace-nowrap">{dateFormatter.format(count.completedAt)}</span>
            </div>
          ) : null}
          {count.cancelledAt ? (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t.stockCounts.detail.metaCancelled}</span>
              <span className="whitespace-nowrap">{dateFormatter.format(count.cancelledAt)}</span>
            </div>
          ) : null}
          {count.cancelReason ? (
            <div className="flex justify-between md:col-span-2 lg:col-span-3">
              <span className="text-muted-foreground">{t.stockCounts.detail.metaReason}</span>
              <span className="max-w-[70%] text-right">{count.cancelReason}</span>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Blind mode banner */}
      {isBlind ? (
        <output className="flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
          <p>{t.stockCounts.detail.blindBanner}</p>
        </output>
      ) : null}

      {/* Add entry form (only when editable) */}
      {canAddEntry(state) && !isReadOnly ? (
        <Card>
          <CardContent className="pt-6">
            <EntryForm
              countId={count.id}
              scope={{
                orgId: membership.organizationId,
                userId: session.user.id,
              }}
              rows={scopeRows}
              bins={binOptions}
              labels={entryFormLabels}
            />
          </CardContent>
        </Card>
      ) : null}

      {/* Items in count table */}
      <Card>
        <CardHeader>
          <CardTitle>{t.stockCounts.detail.itemsTableHeading}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {count.snapshots.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              {t.stockCounts.detail.itemsTableEmpty}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.stockCounts.detail.columnSku}</TableHead>
                    <TableHead>{t.stockCounts.detail.columnItem}</TableHead>
                    <TableHead>{t.stockCounts.detail.columnWarehouse}</TableHead>
                    {isBlind ? null : (
                      <TableHead className="text-right">
                        {t.stockCounts.detail.columnExpected}
                      </TableHead>
                    )}
                    <TableHead className="text-right">
                      {t.stockCounts.detail.columnCounted}
                    </TableHead>
                    {isBlind ? null : (
                      <>
                        <TableHead className="text-right">
                          {t.stockCounts.detail.columnVariance}
                        </TableHead>
                        <TableHead>{t.stockCounts.detail.columnStatus}</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {count.snapshots.map((snapshot, idx) => {
                    const variance = varianceRows[idx];
                    const item = itemById.get(snapshot.itemId);
                    const warehouse = warehouseById.get(snapshot.warehouseId);
                    return (
                      <TableRow key={snapshot.id}>
                        <TableCell className="font-mono text-xs">
                          {item ? (
                            <Link href={`/items/${snapshot.itemId}`} className="hover:underline">
                              {item.sku}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          {item ? (
                            <Link href={`/items/${snapshot.itemId}`} className="hover:underline">
                              {item.name}
                            </Link>
                          ) : (
                            snapshot.itemId
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {warehouse?.name ?? snapshot.warehouseId}
                        </TableCell>
                        {isBlind ? null : (
                          <TableCell className="text-right tabular-nums">
                            {snapshot.expectedQuantity}
                          </TableCell>
                        )}
                        <TableCell className="text-right tabular-nums">
                          {variance?.countedQuantity ?? 0}
                        </TableCell>
                        {isBlind ? null : (
                          <>
                            <TableCell className="text-right tabular-nums">
                              <span
                                className={
                                  variance && variance.variance > 0
                                    ? "text-emerald-600"
                                    : variance && variance.variance < 0
                                      ? "text-destructive"
                                      : "text-muted-foreground"
                                }
                              >
                                {variance && variance.variance > 0 ? "+" : ""}
                                {variance?.variance ?? 0}
                              </span>
                            </TableCell>
                            <TableCell>
                              {variance ? varianceBadge(variance.status) : null}
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Entry log */}
      <Card>
        <CardHeader>
          <CardTitle>{t.stockCounts.detail.entriesHeading}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {visibleEntries.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              {t.stockCounts.detail.entriesEmpty}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.stockCounts.detail.entriesColumnWhen}</TableHead>
                  <TableHead>{t.stockCounts.detail.entriesColumnItem}</TableHead>
                  <TableHead>{t.stockCounts.detail.entriesColumnWarehouse}</TableHead>
                  <TableHead>{t.stockCounts.detail.entriesColumnBin}</TableHead>
                  <TableHead className="text-right">
                    {t.stockCounts.detail.entriesColumnQty}
                  </TableHead>
                  <TableHead>{t.stockCounts.detail.entriesColumnNote}</TableHead>
                  <TableHead>{t.stockCounts.detail.entriesColumnBy}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleEntries.map((entry) => {
                  const item = itemById.get(entry.itemId);
                  const warehouse = warehouseById.get(entry.warehouseId);
                  const user = entry.countedByUserId ? userById.get(entry.countedByUserId) : null;
                  return (
                    <TableRow key={entry.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {dateFormatter.format(entry.countedAt)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {item ? (
                          <Link href={`/items/${entry.itemId}`} className="hover:underline">
                            <span className="font-mono text-xs text-muted-foreground">
                              {item.sku}
                            </span>{" "}
                            {item.name}
                          </Link>
                        ) : (
                          entry.itemId
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {warehouse?.name ?? entry.warehouseId}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {entry.binId ? (binById.get(entry.binId)?.code ?? entry.binId) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {entry.countedQuantity}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                        {entry.note ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {user?.name ?? user?.email ?? t.movements.unknownUser}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          {/* Phase 6.8 — load more entries */}
          {nextEntryCursor ? (
            <div className="flex justify-center border-t py-3">
              <Link
                href={`/stock-counts/${id}?entryCursor=${encodeURIComponent(nextEntryCursor)}`}
                className="text-sm font-medium text-primary hover:underline"
              >
                Load more entries &rarr;
              </Link>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
