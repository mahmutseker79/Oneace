import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  BarChart3,
  Check,
  CheckCircle2,
  Circle,
  Download,
  Eye,
  FileUp,
  Info,
  Package,
  Plus,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ItemsCacheBanner } from "@/components/offline/items-cache-banner";
import { ItemsCacheSync } from "@/components/offline/items-cache-sync";
import { DeleteButton } from "@/components/shell/delete-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import type { ItemSnapshotRow } from "@/lib/offline/items-cache";
import { requireActiveMembership } from "@/lib/session";
import { formatRelative } from "@/lib/format-relative";
import { formatCurrency } from "@/lib/utils";

import { CompactBridge } from "@/components/bridge/compact-bridge";

import { deleteItemAction } from "./actions";
import { dismissBridgeAction } from "./dismiss-bridge-action";

type SearchParams = Promise<{ status?: string }>;

type ItemStatus = "ACTIVE" | "ARCHIVED" | "DRAFT";
type StatusFilter = "all" | ItemStatus;

function parseStatusFilter(raw: string | undefined): StatusFilter {
  if (raw === "active") return "ACTIVE";
  if (raw === "archived") return "ARCHIVED";
  if (raw === "draft") return "DRAFT";
  return "all";
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.items.metaTitle };
}

export default async function ItemsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const { membership, session } = await requireActiveMembership();
  const t = await getMessages();
  const region = await getRegion();

  const params = (await searchParams) ?? {};
  const statusFilter = parseStatusFilter(params.status);

  const items = await db.item.findMany({
    where: {
      organizationId: membership.organizationId,
      ...(statusFilter === "all" ? {} : { status: statusFilter }),
    },
    include: {
      category: { select: { id: true, name: true } },
      stockLevels: { select: { quantity: true } },
      // P8.4 — needed for low-stock → PO shortcut (indexed column, negligible cost)
      preferredSupplier: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // ── P3.3 / P3.4 + P7 — setup progress & operational trust queries ───
  // Lightweight counts to drive the stateful setup checklist, forward
  // guidance banners, and P7 operational trust cues. Parallel batch.
  const [warehouseCount, completedCountCount, reorderConfiguredCount, lastCount, lastMovement] =
    await Promise.all([
      db.warehouse.count({
        where: { organizationId: membership.organizationId, isArchived: false },
      }),
      db.stockCount.count({
        where: { organizationId: membership.organizationId, state: "COMPLETED" },
      }),
      // P7.1 — how many items already have a reorder point?
      // reorderPoint is Int @default(0), NOT nullable — so we check > 0
      db.item.count({
        where: {
          organizationId: membership.organizationId,
          reorderPoint: { gt: 0 },
        },
      }),
      // P7.7 — most recent completed stock count
      db.stockCount.findFirst({
        where: { organizationId: membership.organizationId, state: "COMPLETED" },
        orderBy: { updatedAt: "desc" },
        select: { id: true, name: true, updatedAt: true },
      }),
      // P7.7 — most recent stock movement
      db.stockMovement.findFirst({
        where: { organizationId: membership.organizationId },
        orderBy: { createdAt: "desc" },
        select: { id: true, createdAt: true },
      }),
    ]);

  const hasItems = items.length > 0;
  const hasLocation = warehouseCount > 0;
  const hasCompletedCount = completedCountCount > 0;
  const setupComplete = hasItems && hasLocation && hasCompletedCount;

  // Offline cache must reflect the default, unfiltered inventory list so
  // switching to /items?status=archived doesn't silently shrink the
  // snapshot stored in IndexedDB. When no filter is active we reuse the
  // already-fetched rows; otherwise we run a second query with the same
  // shape and limits as the prior pre-filter snapshot behavior. See the
  // cache-contract comment in `src/components/offline/items-cache-sync.tsx`
  // — `cacheItems` is the unfiltered snapshot and is decoupled from the
  // rendered `items` variable on purpose.
  // IMPORTANT: Must be declared before `totalItems` which depends on it.
  const cacheItems =
    statusFilter === "all"
      ? items
      : await db.item.findMany({
          where: { organizationId: membership.organizationId },
          include: {
            category: { select: { id: true, name: true } },
            stockLevels: { select: { quantity: true } },
            preferredSupplier: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 100,
        });

  // ── P8.5a — totalItems must reflect the *unfiltered* inventory so the
  // trust micro-stat line and reorder partial-copy show correct numbers
  // even when a status filter (?status=archived) is active.
  const totalItems = cacheItems.length;

  // ── P8.1 — Low-stock detection (zero extra queries) ───────────────
  // Reuses the already-fetched `items` array. Same filter logic as
  // src/app/(app)/reports/low-stock/page.tsx lines 92-99.
  const lowStockItems = setupComplete
    ? items.filter((item) => {
        if (item.reorderPoint <= 0) return false;
        const onHand = item.stockLevels.reduce((sum, l) => sum + l.quantity, 0);
        return onHand <= item.reorderPoint;
      })
    : [];
  const lowStockCount = lowStockItems.length;

  // ── P8.4 — Identify single dominant supplier for direct PO shortcut ─
  const lowStockSupplierIds = new Set(
    lowStockItems
      .map((item) => item.preferredSupplier?.id)
      .filter(Boolean),
  );
  const singleSupplier =
    lowStockSupplierIds.size === 1
      ? lowStockItems.find((item) => item.preferredSupplier)?.preferredSupplier ?? null
      : null;
  const directPoHref = singleSupplier
    ? `/purchase-orders/new?supplier=${singleSupplier.id}&items=${lowStockItems.map((i) => i.id).join(",")}`
    : null;
  // ── P8.1 + P8.4 end ──────────────────────────────────────────────

  // ── P7.1 — Context-aware reorder card ──────────────────────────────
  const reorderCard = (() => {
    if (reorderConfiguredCount === 0) {
      // P8.3 — link to batch editor instead of single-item edit
      return {
        icon: AlertTriangle,
        title: t.setup.bridgeReorderTitle,
        body: t.setup.bridgeReorderBodyNone,
        cta: t.setup.bridgeReorderCtaBatch,
        href: "/items/reorder-config",
      };
    }
    if (reorderConfiguredCount < totalItems) {
      // P8.3 — link to batch editor to finish remaining items
      const remaining = totalItems - reorderConfiguredCount;
      return {
        icon: AlertTriangle,
        title: t.setup.bridgeReorderTitlePartial,
        body: t.setup.bridgeReorderBodyPartial
          .replace("{remaining}", String(remaining))
          .replace("{total}", String(totalItems)),
        cta: t.setup.bridgeReorderCtaFinish,
        href: "/items/reorder-config",
      };
    }
    // All items configured — link to low-stock report
    return {
      icon: AlertTriangle,
      title: t.setup.bridgeReorderTitleDone,
      body: t.setup.bridgeReorderBodyDone,
      cta: t.setup.bridgeReorderCtaReport,
      href: "/reports/low-stock",
    };
  })();
  // ── P7.1 end ──────────────────────────────────────────────────────

  // ── P7.2 — Adaptive bridge stage ───────────────────────────────────
  // Parse the per-member uiState to determine bridge visibility.
  // Stage: "full" (first 3 visits) → "compact" (visits 3+) → "gone" (dismissed)
  type BridgeStage = "full" | "compact" | "gone";
  const uiState = (membership.uiState as Record<string, unknown> | null) ?? {};
  const bridgeVisits = typeof uiState.bridgeVisits === "number" ? uiState.bridgeVisits : 0;
  const bridgeDismissed = uiState.bridgeDismissed === true;
  const successSeen = uiState.successSeen === true;
  const bridgeStage: BridgeStage = bridgeDismissed
    ? "gone"
    : bridgeVisits >= 3
      ? "compact"
      : "full";

  // Fire-and-forget: increment visit count when bridge is visible
  if (setupComplete && bridgeStage !== "gone") {
    void db.membership
      .update({
        where: { id: membership.id },
        data: {
          uiState: { ...uiState, bridgeVisits: bridgeVisits + 1 },
        },
      })
      .catch(() => {});
  }
  // ── P7.2 end ──────────────────────────────────────────────────────

  // ── P8.5b — Mark success banner as seen (fire-and-forget) ─────────
  // The success banner shows when completedCountCount === 1. Without
  // this flag, it re-renders on every visit during that window.
  const showSuccessBanner = setupComplete && completedCountCount === 1 && !successSeen;
  if (showSuccessBanner) {
    void db.membership
      .update({
        where: { id: membership.id },
        data: {
          uiState: { ...uiState, successSeen: true },
        },
      })
      .catch(() => {});
  }
  // ── P8.5b end ─────────────────────────────────────────────────────

  // Build the serializable snapshot the client passes to IndexedDB.
  // We compute onHand once here (server-side) so the cache rendered
  // offline matches what the user just saw.
  const cacheScope = {
    orgId: membership.organizationId,
    userId: session.user.id,
  };
  const cacheRows: ItemSnapshotRow[] = cacheItems.map((item) => ({
    id: item.id,
    sku: item.sku,
    barcode: item.barcode,
    name: item.name,
    unit: item.unit,
    status: item.status,
    categoryId: item.category?.id ?? null,
    categoryName: item.category?.name ?? null,
    salePrice: item.salePrice ? item.salePrice.toString() : null,
    currency: item.currency,
    onHand: item.stockLevels.reduce((sum, level) => sum + level.quantity, 0),
  }));

  function statusBadge(status: "ACTIVE" | "ARCHIVED" | "DRAFT") {
    if (status === "ACTIVE") {
      return <Badge>{t.common.active}</Badge>;
    }
    if (status === "DRAFT") {
      return <Badge variant="outline">{t.common.draft}</Badge>;
    }
    return <Badge variant="secondary">{t.common.archived}</Badge>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{t.items.heading}</h1>
          <p className="text-muted-foreground">{t.items.subtitle}</p>
          <ItemsCacheBanner
            scope={cacheScope}
            locale={region.numberLocale}
            labels={{
              onlineFresh: t.offline.cacheStatus.onlineFresh,
              onlineStale: t.offline.cacheStatus.onlineStale,
              offlineCached: t.offline.cacheStatus.offlineCached,
              offlineEmpty: t.offline.cacheStatus.offlineEmpty,
              neverSynced: t.offline.cacheStatus.neverSynced,
            }}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/items/export">
              <Download className="h-4 w-4" />
              {t.common.exportCsv}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/items/import">
              <FileUp className="h-4 w-4" />
              {t.items.importCta}
            </Link>
          </Button>
          <Button asChild>
            <Link href="/items/new">
              <Plus className="h-4 w-4" />
              {t.items.newItem}
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t.items.filter.label}:
        </span>
        {(
          [
            { key: "all", label: t.items.filter.all, href: "/items" },
            { key: "ACTIVE", label: t.items.filter.active, href: "/items?status=active" },
            { key: "ARCHIVED", label: t.items.filter.archived, href: "/items?status=archived" },
            { key: "DRAFT", label: t.items.filter.draft, href: "/items?status=draft" },
          ] as const
        ).map((opt) => (
          <Button
            key={opt.key}
            size="sm"
            variant={statusFilter === opt.key ? "default" : "outline"}
            asChild
          >
            <Link href={opt.href}>{opt.label}</Link>
          </Button>
        ))}
      </div>

      {/* ── P7.7: Trust micro-stat line (only when setup is complete) ── */}
      {setupComplete ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>
            {t.setup.trustSummary
              .replace("{items}", String(totalItems))
              .replace("{locations}", String(warehouseCount))}
          </span>
          {lastCount ? (
            <span>
              {t.setup.trustLastCountLabel}{" "}
              <span className="tabular-nums">{formatRelative(lastCount.updatedAt, undefined, region.numberLocale)}</span>
            </span>
          ) : null}
          {lastMovement ? (
            <span>
              {t.setup.trustLastMovementLabel}{" "}
              <span className="tabular-nums">{formatRelative(lastMovement.createdAt, undefined, region.numberLocale)}</span>
            </span>
          ) : null}
        </div>
      ) : null}

      {/* ── P8.1: Low-stock alert banner ─────────────────────────────── */}
      {setupComplete && lowStockCount > 0 ? (
        <Alert className="border-amber-500/40 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-sm">
            {t.setup.lowStockBannerTitle.replace("{count}", String(lowStockCount))}
          </AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-2 text-xs">
            <Button variant="link" size="sm" className="h-auto p-0 text-xs" asChild>
              <Link href="/reports/low-stock">
                {t.setup.lowStockBannerCta}
                <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
            {directPoHref && singleSupplier ? (
              <>
                <span className="text-muted-foreground">·</span>
                <Button variant="link" size="sm" className="h-auto p-0 text-xs" asChild>
                  <Link href={directPoHref}>
                    {t.setup.lowStockBannerCtaDirect.replace("{supplier}", singleSupplier.name)}
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {/* ── CASE A: No items yet — empty card ─────────────────────────── */}
      {items.length === 0 ? (
        <Card>
          <CardHeader className="items-center text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Package className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle>{t.items.emptyTitle}</CardTitle>
            <CardDescription>{t.items.emptyBody}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-2">
            <Button asChild>
              <Link href="/items/new">
                <Plus className="h-4 w-4" />
                {t.items.emptyCta}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/items/import">
                <FileUp className="h-4 w-4" />
                {t.items.emptyImportCta}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
        {/* ── CASE B: Items exist, setup incomplete — banner ───────────── */}
        {!setupComplete ? (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>
              {!hasLocation
                ? t.setup.bannerAddLocation
                : t.setup.bannerReadyToCount}
            </AlertTitle>
            <AlertDescription>
              <Button variant="link" className="h-auto p-0" asChild>
                <Link
                  href={!hasLocation ? "/warehouses/new" : "/stock-counts/new"}
                >
                  {!hasLocation
                    ? t.setup.bannerAddLocationCta
                    : t.setup.bannerReadyToCountCta}
                  <ArrowRight className="ml-1 inline h-3 w-3" />
                </Link>
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {/* ── P7.4 + P8.5b: Success moment — shown once, then flagged ── */}
        {showSuccessBanner ? (
          <Alert className="border-emerald-500/40 bg-emerald-500/10">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <AlertTitle>{t.setup.complete}</AlertTitle>
            <AlertDescription className="text-sm text-muted-foreground">
              {t.setup.completeBody}
            </AlertDescription>
          </Alert>
        ) : null}

        {/* ── CASE C: Setup complete — post-setup operational bridge ──── */}
        {/* P7.2: bridge renders as full → compact → gone based on bridgeStage */}
        {setupComplete && bridgeStage === "full" ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">{t.setup.bridgeHeading}</h2>
              <p className="text-sm text-muted-foreground">
                {t.setup.bridgeSubtitle}
              </p>
            </div>
            {/* Desktop: full cards — hidden on mobile */}
            <div className="hidden gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-4">
              {[
                reorderCard,
                {
                  icon: ArrowLeftRight,
                  title: t.setup.bridgeMovementTitle,
                  body: t.setup.bridgeMovementBody,
                  cta: t.setup.bridgeMovementCta,
                  href: "/movements",
                },
                {
                  icon: BarChart3,
                  title: t.setup.bridgeReportsTitle,
                  body: t.setup.bridgeReportsBody,
                  cta: t.setup.bridgeReportsCta,
                  href: "/reports",
                },
                {
                  icon: Users,
                  title: t.setup.bridgeTeamTitle,
                  body: t.setup.bridgeTeamBody,
                  cta: t.setup.bridgeTeamCta,
                  href: "/users",
                },
              ].map((card) => (
                <Card key={card.href} className="flex flex-col">
                  <CardHeader className="flex-1 space-y-1.5 pb-3">
                    <card.icon className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-sm font-medium">
                      {card.title}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {card.body}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      asChild
                    >
                      <Link href={card.href}>
                        {card.cta}
                        <ArrowRight className="ml-1 h-3 w-3" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
            {/* Mobile: compact 2×2 grid — visible only below sm */}
            <div className="grid grid-cols-2 gap-2 sm:hidden">
              {[
                reorderCard,
                {
                  icon: ArrowLeftRight,
                  title: t.setup.bridgeMovementTitle,
                  cta: t.setup.bridgeMovementCta,
                  href: "/movements",
                },
                {
                  icon: BarChart3,
                  title: t.setup.bridgeReportsTitle,
                  cta: t.setup.bridgeReportsCta,
                  href: "/reports",
                },
                {
                  icon: Users,
                  title: t.setup.bridgeTeamTitle,
                  cta: t.setup.bridgeTeamCta,
                  href: "/users",
                },
              ].map((card) => (
                <Link
                  key={card.href}
                  href={card.href}
                  className="flex flex-col items-center gap-1 rounded-md border p-3 text-center text-xs transition-colors hover:bg-accent/50"
                >
                  <card.icon className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium leading-tight">{card.title}</span>
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        {/* P7.2: Compact bridge — single row with quick-links + dismiss */}
        {setupComplete && bridgeStage === "compact" ? (
          <CompactBridge
            links={[
              { title: reorderCard.cta, href: reorderCard.href },
              { title: t.setup.bridgeMovementCta, href: "/movements" },
              { title: t.setup.bridgeReportsCta, href: "/reports" },
              { title: t.setup.bridgeTeamCta, href: "/users" },
            ]}
            labels={{
              label: t.setup.bridgeCompactLabel,
              dismissLabel: t.setup.bridgeDismissLabel,
            }}
            dismissAction={dismissBridgeAction}
          />
        ) : null}

        {/* ── Items table ─────────────────────────────────────────────── */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.items.columnSku}</TableHead>
                  <TableHead>{t.items.columnName}</TableHead>
                  <TableHead>{t.items.columnCategory}</TableHead>
                  <TableHead className="text-right">{t.items.columnStock}</TableHead>
                  <TableHead>{t.items.columnStatus}</TableHead>
                  <TableHead className="w-36 text-right">{t.items.columnActions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const onHand = item.stockLevels.reduce((sum, level) => sum + level.quantity, 0);
                  const price = item.salePrice
                    ? formatCurrency(Number(item.salePrice), {
                        currency: item.currency,
                        locale: region.numberLocale,
                      })
                    : null;
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                      <TableCell>
                        <Link href={`/items/${item.id}`} className="font-medium hover:underline">
                          {item.name}
                        </Link>
                        {price ? (
                          <div className="text-xs text-muted-foreground">{price}</div>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.category?.name ?? t.common.none}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {onHand} {item.unit}
                      </TableCell>
                      <TableCell>{statusBadge(item.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/items/${item.id}`} aria-label={t.common.search}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/items/${item.id}/edit`}>{t.common.edit}</Link>
                          </Button>
                          <DeleteButton
                            labels={{
                              trigger: t.common.delete,
                              title: t.items.deleteConfirmTitle,
                              body: t.items.deleteConfirmBody,
                              cancel: t.common.cancel,
                              confirm: t.common.delete,
                            }}
                            action={deleteItemAction.bind(null, item.id)}
                            iconOnly
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* ── P7.7: Activity footer — recent count + movement links ──── */}
        {setupComplete && (lastCount || lastMovement) ? (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            {lastCount ? (
              <Link href={`/stock-counts/${lastCount.id}`} className="hover:underline">
                {t.setup.trustLastCountLabel} {lastCount.name ?? t.common.unknown}{" "}
                <span className="tabular-nums">({formatRelative(lastCount.updatedAt, undefined, region.numberLocale)})</span>
              </Link>
            ) : null}
            {lastMovement ? (
              <Link href="/movements" className="hover:underline">
                {t.setup.trustLastMovementLabel}{" "}
                <span className="tabular-nums">{formatRelative(lastMovement.createdAt, undefined, region.numberLocale)}</span>
              </Link>
            ) : null}
          </div>
        ) : null}
        </>
      )}

      {/* ── P5.2: Persistent setup checklist (visible until setupComplete) ── */}
      {!setupComplete ? (
        <div className="mx-auto max-w-md space-y-3">
          <p className="text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t.setup.heading}
          </p>
          {[
            {
              done: hasItems,
              label: t.setup.step1,
              doneLabel: t.setup.step1Done,
              href: "/items/new",
              sublabel: undefined as string | undefined,
              sublabelHref: "/items/import" as string | undefined,
              sublabelText: t.setup.step1Import,
            },
            {
              done: hasLocation,
              label: t.setup.step2,
              doneLabel: t.setup.step2Done,
              href: "/warehouses",
              sublabel: hasLocation ? t.setup.step2Auto : undefined,
              sublabelHref: undefined as string | undefined,
              sublabelText: undefined as string | undefined,
            },
            {
              done: hasCompletedCount,
              label: t.setup.step3,
              doneLabel: t.setup.step3Done,
              href: "/stock-counts/new",
              sublabel: undefined as string | undefined,
              sublabelHref: undefined as string | undefined,
              sublabelText: undefined as string | undefined,
            },
          ].map((step, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-lg border bg-card p-3 text-sm transition-colors hover:bg-accent/50"
            >
              {step.done ? (
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-600 text-white">
                  <Check className="h-3.5 w-3.5" />
                </span>
              ) : (
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/40">
                  <Circle className="h-2.5 w-2.5 text-muted-foreground/40" />
                </span>
              )}
              {/* P8.5c — merged label + arrow into one link to reduce tab stops */}
              <Link
                href={step.href}
                className={`flex flex-1 items-center justify-between ${step.done ? "text-muted-foreground line-through" : "hover:underline"}`}
              >
                <span>
                  {step.done ? step.doneLabel : step.label}
                  {step.sublabel ? (
                    <span className="block text-xs text-muted-foreground font-normal no-underline">{step.sublabel}</span>
                  ) : null}
                </span>
                {!step.done ? (
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : null}
              </Link>
              {!step.done && step.sublabelHref ? (
                <Link href={step.sublabelHref} className="block text-xs text-muted-foreground hover:underline -mt-1">
                  {step.sublabelText}
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <ItemsCacheSync scope={cacheScope} rows={cacheRows} />
    </div>
  );
}
