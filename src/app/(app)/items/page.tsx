import { Download, Eye, FileUp, Package, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ItemsCacheBanner } from "@/components/offline/items-cache-banner";
import { ItemsCacheSync } from "@/components/offline/items-cache-sync";
import { DeleteButton } from "@/components/shell/delete-button";
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
import { formatCurrency } from "@/lib/utils";

import { deleteItemAction } from "./actions";

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
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Offline cache must reflect the default, unfiltered inventory list so
  // switching to /items?status=archived doesn't silently shrink the
  // snapshot stored in IndexedDB. When no filter is active we reuse the
  // already-fetched rows; otherwise we run a second query with the same
  // shape and limits as the prior pre-filter snapshot behavior. See the
  // cache-contract comment in `src/components/offline/items-cache-sync.tsx`
  // — `cacheItems` is the unfiltered snapshot and is decoupled from the
  // rendered `items` variable on purpose.
  const cacheItems =
    statusFilter === "all"
      ? items
      : await db.item.findMany({
          where: { organizationId: membership.organizationId },
          include: {
            category: { select: { id: true, name: true } },
            stockLevels: { select: { quantity: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 100,
        });

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

      {items.length === 0 ? (
        <Card>
          <CardHeader className="items-center text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Package className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle>{t.items.emptyTitle}</CardTitle>
            <CardDescription>{t.items.emptyBody}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button asChild>
              <Link href="/items/new">
                <Plus className="h-4 w-4" />
                {t.items.emptyCta}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
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
      )}

      <ItemsCacheSync scope={cacheScope} rows={cacheRows} />
    </div>
  );
}
