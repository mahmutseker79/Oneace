import { ArrowLeftRight, ArrowRightLeft, Download, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { MobileCard, ResponsiveTable } from "@/components/ui/responsive-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/lib/db";
import { format, getMessages, getRegion } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";

import {
  type MovementSearchParams,
  buildMovementWhere,
  hasAnyFilter,
  parseMovementFilter,
} from "./filter";
import { MovementsFilterBar } from "./movements-filter-bar";

type MovementType = "RECEIPT" | "ISSUE" | "ADJUSTMENT" | "TRANSFER" | "BIN_TRANSFER" | "COUNT";

// Sprint 4: cursor-based pagination. Page size is 50 for both modes.
// Cursor pagination avoids the OFFSET performance cliff at scale.
const PAGE_SIZE = 50;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.movements.metaTitle };
}

type MovementsPageProps = {
  searchParams: Promise<MovementSearchParams>;
};

function buildExportHref(filter: {
  rawFrom: string;
  rawTo: string;
  rawType: string;
  rawWarehouse: string;
  rawQ: string;
}): string {
  const params = new URLSearchParams();
  if (filter.rawFrom) params.set("from", filter.rawFrom);
  if (filter.rawTo) params.set("to", filter.rawTo);
  if (filter.rawType) params.set("type", filter.rawType);
  if (filter.rawWarehouse) params.set("warehouse", filter.rawWarehouse);
  if (filter.rawQ) params.set("q", filter.rawQ);
  const qs = params.toString();
  return qs ? `/movements/export?${qs}` : "/movements/export";
}

export default async function MovementsPage({ searchParams }: MovementsPageProps) {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();
  const region = await getRegion();

  // P10.1 — capability flags for conditional UI rendering
  const canCreate = hasCapability(membership.role, "movements.create");
  const canExport = hasCapability(membership.role, "reports.export");

  const filter = await parseMovementFilter(searchParams);
  const filterActive = hasAnyFilter(filter);
  const params = await searchParams;
  const cursor = typeof params?.cursor === "string" ? params.cursor : undefined;

  // Load the org's warehouses for the filter dropdown in parallel
  // with the ledger query. Independent of the active filter so a
  // warehouse you've already selected doesn't disappear from the
  // dropdown if a different filter narrows the ledger — otherwise
  // you'd lose the ability to broaden. Warehouse counts per org are
  // bounded for SMBs, so loading them all is cheap.
  const [movements, warehouses] = await Promise.all([
    db.stockMovement.findMany({
      where: {
        organizationId: membership.organizationId,
        ...buildMovementWhere(filter),
      },
      include: {
        item: { select: { id: true, sku: true, name: true, unit: true } },
        warehouse: { select: { id: true, name: true, code: true } },
        toWarehouse: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }),
    db.warehouse.findMany({
      where: { organizationId: membership.organizationId, isArchived: false },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const dateFormatter = new Intl.DateTimeFormat(region.numberLocale, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  function typeBadge(type: MovementType) {
    const label = t.movements.types[type];
    if (type === "RECEIPT") return <Badge variant="success">{label}</Badge>;
    if (type === "ISSUE") return <Badge variant="destructive">{label}</Badge>;
    if (type === "ADJUSTMENT") return <Badge variant="warning">{label}</Badge>;
    if (type === "TRANSFER") return <Badge variant="info">{label}</Badge>;
    return <Badge variant="outline">{label}</Badge>;
  }

  const typeOptions = (["RECEIPT", "ISSUE", "ADJUSTMENT", "TRANSFER", "COUNT"] as const).map(
    (type) => ({
      value: type,
      label: t.movements.types[type],
    }),
  );

  // Sprint 4: cursor-based pagination
  const hasNextPage = movements.length > PAGE_SIZE;
  const pageMovements = hasNextPage ? movements.slice(0, PAGE_SIZE) : movements;
  const nextCursor = hasNextPage ? pageMovements[pageMovements.length - 1]?.id : null;

  const countLine = filterActive
    ? format(t.movements.filter.resultCount, { count: pageMovements.length })
    : format(t.movements.filter.resultCountUnfiltered, {
        count: pageMovements.length,
      });

  const truncated = hasNextPage;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.movements.heading}
        description={t.movements.subtitle}
        actions={
          <div className="flex items-center gap-2">
            {canExport ? (
              <Button asChild variant="outline">
                <Link href={buildExportHref(filter)}>
                  <Download className="h-4 w-4" />
                  {t.common.exportCsv}
                </Link>
              </Button>
            ) : null}
            {canCreate ? (
              <Button asChild variant="outline">
                <Link href="/movements/transfers/new">
                  <ArrowRightLeft className="h-4 w-4" />
                  {t.movements.transfers.heading}
                </Link>
              </Button>
            ) : null}
            {canCreate ? (
              <Button asChild>
                <Link href="/movements/new">
                  <Plus className="h-4 w-4" />
                  {t.movements.newMovement}
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />

      <MovementsFilterBar
        initialFrom={filter.rawFrom}
        initialTo={filter.rawTo}
        initialType={filter.rawType}
        initialWarehouse={filter.rawWarehouse}
        initialQ={filter.rawQ}
        typeOptions={typeOptions}
        warehouseOptions={warehouses}
        labels={{
          heading: t.movements.filter.heading,
          fromLabel: t.movements.filter.fromLabel,
          toLabel: t.movements.filter.toLabel,
          typeLabel: t.movements.filter.typeLabel,
          typeAll: t.movements.filter.typeAll,
          warehouseLabel: t.movements.filter.warehouseLabel,
          warehouseAll: t.movements.filter.warehouseAll,
          itemLabel: t.movements.filter.itemLabel,
          itemPlaceholder: t.movements.filter.itemPlaceholder,
          apply: t.movements.filter.apply,
          clear: t.movements.filter.clear,
          invalidRange: t.movements.filter.invalidRange,
        }}
      />

      {pageMovements.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title={filterActive ? t.movements.filter.emptyFilteredTitle : t.movements.emptyTitle}
          description={filterActive ? t.movements.filter.emptyFilteredBody : t.movements.emptyBody}
          variant={filterActive ? "filtered" : "empty"}
          actions={
            !filterActive && canCreate
              ? [
                  {
                    label: t.movements.emptyCta,
                    href: "/movements/new",
                    icon: Plus,
                  },
                ]
              : undefined
          }
        />
      ) : (
        <>
          <div className="text-muted-foreground flex flex-col gap-1 text-xs sm:flex-row sm:items-center sm:justify-between">
            <span>{countLine}</span>
            {truncated ? (
              <span className="italic">
                {format(t.movements.filter.truncatedNotice, { limit: PAGE_SIZE })}
              </span>
            ) : null}
          </div>
          <Card>
            <CardContent className="p-0">
              <ResponsiveTable
                cardView={pageMovements.map((m) => {
                  const signedQty = m.direction < 0 ? -m.quantity : m.quantity;
                  const qtyPrefix =
                    signedQty > 0 ? t.movements.directionIn : t.movements.directionOut;
                  const absQty = Math.abs(signedQty);
                  const warehouseCell =
                    m.type === "TRANSFER" && m.toWarehouse
                      ? `${m.warehouse.name} → ${m.toWarehouse.name}`
                      : m.warehouse.name;
                  return (
                    <MobileCard
                      key={m.id}
                      href={`/movements/${m.id}`}
                      title={m.item.name}
                      subtitle={m.item.sku}
                      badge={typeBadge(m.type as MovementType)}
                      fields={[
                        {
                          label: t.movements.columnQuantity,
                          value: (
                            <span className={signedQty >= 0 ? "text-success" : "text-destructive"}>
                              {qtyPrefix}
                              {absQty} {m.item.unit}
                            </span>
                          ),
                        },
                        {
                          label: t.movements.columnWarehouse,
                          value: warehouseCell,
                        },
                        {
                          label: t.movements.columnDate,
                          value: dateFormatter.format(m.createdAt),
                        },
                      ]}
                    />
                  );
                })}
              >
                <Table className="min-w-[640px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.movements.columnDate}</TableHead>
                      <TableHead>{t.movements.columnItem}</TableHead>
                      <TableHead>{t.movements.columnType}</TableHead>
                      <TableHead>{t.movements.columnWarehouse}</TableHead>
                      <TableHead className="text-right">{t.movements.columnQuantity}</TableHead>
                      <TableHead>{t.movements.columnReference}</TableHead>
                      <TableHead>{t.movements.columnUser}</TableHead>
                      {/* Phase 15.2 — detail link column */}
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageMovements.map((m) => {
                      const signedQty = m.direction < 0 ? -m.quantity : m.quantity;
                      const qtyPrefix =
                        signedQty > 0 ? t.movements.directionIn : t.movements.directionOut;
                      const absQty = Math.abs(signedQty);
                      const warehouseCell =
                        m.type === "TRANSFER" && m.toWarehouse
                          ? `${m.warehouse.name} ${t.movements.transferLabel} ${m.toWarehouse.name}`
                          : m.warehouse.name;
                      const userLabel =
                        m.createdBy?.name ?? m.createdBy?.email ?? t.movements.unknownUser;
                      return (
                        <TableRow key={m.id} className="hover:bg-muted/50 transition-colors">
                          <TableCell className="text-muted-foreground whitespace-nowrap text-xs">
                            {dateFormatter.format(m.createdAt)}
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/items/${m.item.id}`}
                              className="font-medium hover:underline"
                            >
                              {m.item.name}
                            </Link>
                            <div className="text-muted-foreground font-mono text-xs">
                              {m.item.sku}
                            </div>
                          </TableCell>
                          <TableCell>{typeBadge(m.type as MovementType)}</TableCell>
                          <TableCell className="text-sm">{warehouseCell}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            <span className={signedQty >= 0 ? "text-success" : "text-destructive"}>
                              {qtyPrefix}
                              {absQty} {m.item.unit}
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {m.reference ?? "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {userLabel}
                          </TableCell>
                          {/* Phase 15.2 — link to movement detail */}
                          <TableCell className="text-right">
                            <Link
                              href={`/movements/${m.id}`}
                              className="text-muted-foreground hover:text-foreground"
                              aria-label="View movement details"
                            >
                              →
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ResponsiveTable>
            </CardContent>
          </Card>
          {/* Sprint 4: cursor-based pagination — "Load more" link */}
          {nextCursor ? (
            <div className="flex justify-center">
              <Button variant="outline" asChild>
                <Link
                  href={`/movements?${new URLSearchParams({
                    ...(filter.rawFrom ? { from: filter.rawFrom } : {}),
                    ...(filter.rawTo ? { to: filter.rawTo } : {}),
                    ...(filter.rawType ? { type: filter.rawType } : {}),
                    ...(filter.rawWarehouse ? { warehouse: filter.rawWarehouse } : {}),
                    ...(filter.rawQ ? { q: filter.rawQ } : {}),
                    cursor: nextCursor,
                  }).toString()}`}
                >
                  {t.common.loadMore}
                </Link>
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
