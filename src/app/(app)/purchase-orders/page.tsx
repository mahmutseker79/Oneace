import { Download, Plus, ShoppingCart } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AdvancedFeatureBanner } from "@/components/shell/advanced-feature-banner";
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
import { PurchaseOrderStatus } from "@/generated/prisma";
import { db } from "@/lib/db";
import { format, getMessages, getRegion } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";
import { formatCurrency } from "@/lib/utils";

import {
  type PurchaseOrderSearchParams,
  buildPurchaseOrderWhere,
  hasAnyFilter,
  parsePurchaseOrderFilter,
} from "./filter";
import { PurchaseOrdersFilterBar } from "./purchase-orders-filter-bar";

// Row caps mirror the movements page (Sprint 14): the unfiltered
// view shows the most recent 200, a filtered view raises to 500 so
// a status/supplier scope can surface older orders that would
// otherwise scroll off the top.
const UNFILTERED_LIMIT = 200;
const FILTERED_LIMIT = 500;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.purchaseOrders.metaTitle };
}

function formatDateOrDash(value: Date | null | undefined, locale: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(value);
}

function buildExportHref(filter: {
  rawStatus: string;
  rawSupplier: string;
  rawQ: string;
}): string {
  const params = new URLSearchParams();
  if (filter.rawStatus) params.set("status", filter.rawStatus);
  if (filter.rawSupplier) params.set("supplier", filter.rawSupplier);
  if (filter.rawQ) params.set("q", filter.rawQ);
  const qs = params.toString();
  return qs ? `/purchase-orders/export?${qs}` : "/purchase-orders/export";
}

type PurchaseOrdersPageProps = {
  searchParams: Promise<PurchaseOrderSearchParams>;
};

export default async function PurchaseOrdersPage({ searchParams }: PurchaseOrdersPageProps) {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();
  const region = await getRegion();

  // P10.1 — capability flags for conditional UI rendering
  const canCreate = hasCapability(membership.role, "purchaseOrders.create");
  const canExport = hasCapability(membership.role, "reports.export");

  const filter = await parsePurchaseOrderFilter(searchParams);
  const filterActive = hasAnyFilter(filter);
  const limit = filterActive ? FILTERED_LIMIT : UNFILTERED_LIMIT;

  // Supplier dropdown data — we load the full active-supplier list
  // for the org up front because a) it's bounded (an SMB rarely
  // has thousands of suppliers), b) it lets us show supplier names
  // not ids in the filter control, and c) we also use the count to
  // short-circuit to the "add a supplier first" empty state. This
  // list is independent of the PO filter scope so it still shows
  // suppliers you've never raised an order against, which is the
  // right UX — otherwise the dropdown would shrink as you filter
  // and you'd lose the ability to broaden again.
  const [orders, suppliers] = await Promise.all([
    db.purchaseOrder.findMany({
      where: {
        organizationId: membership.organizationId,
        ...buildPurchaseOrderWhere(filter),
      },
      orderBy: { orderedAt: "desc" },
      include: {
        supplier: { select: { id: true, name: true } },
        warehouse: { select: { id: true, name: true, code: true } },
        lines: { select: { orderedQty: true, unitCost: true } },
      },
      take: limit,
    }),
    db.supplier.findMany({
      where: { organizationId: membership.organizationId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (suppliers.length === 0) {
    return (
      <div className="space-y-6">
        <AdvancedFeatureBanner labels={t.advancedFeature} />

        <div>
          <h1 className="text-2xl font-semibold">{t.purchaseOrders.heading}</h1>
          <p className="text-muted-foreground">{t.purchaseOrders.subtitle}</p>
        </div>
        <Card>
          <CardHeader className="items-center text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <ShoppingCart className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle>{t.purchaseOrders.emptyTitle}</CardTitle>
            <CardDescription>{t.purchaseOrders.emptyNoSuppliers}</CardDescription>
          </CardHeader>
          {canCreate ? (
            <CardContent className="flex justify-center">
              <Button asChild>
                <Link href="/suppliers/new">
                  <Plus className="h-4 w-4" />
                  {t.purchaseOrders.emptyNoSuppliersCta}
                </Link>
              </Button>
            </CardContent>
          ) : null}
        </Card>
      </div>
    );
  }

  const statusOptions = (Object.values(PurchaseOrderStatus) as PurchaseOrderStatus[]).map(
    (value) => ({
      value,
      label: t.purchaseOrders.statusBadge[value],
    }),
  );

  const countLine = filterActive
    ? format(t.purchaseOrders.filter.resultCount, { count: orders.length })
    : format(t.purchaseOrders.filter.resultCountUnfiltered, { count: orders.length });

  const truncated = orders.length === limit;

  return (
    <div className="space-y-6">
      <AdvancedFeatureBanner labels={t.advancedFeature} />

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t.purchaseOrders.heading}</h1>
          <p className="text-muted-foreground">{t.purchaseOrders.subtitle}</p>
        </div>
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
            <Button asChild>
              <Link href="/purchase-orders/new">
                <Plus className="h-4 w-4" />
                {t.purchaseOrders.newPurchaseOrder}
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <PurchaseOrdersFilterBar
        initialStatus={filter.rawStatus}
        initialSupplier={filter.rawSupplier}
        initialQ={filter.rawQ}
        statusOptions={statusOptions}
        supplierOptions={suppliers}
        labels={{
          heading: t.purchaseOrders.filter.heading,
          poNumberLabel: t.purchaseOrders.filter.poNumberLabel,
          poNumberPlaceholder: t.purchaseOrders.filter.poNumberPlaceholder,
          statusLabel: t.purchaseOrders.filter.statusLabel,
          statusAll: t.purchaseOrders.filter.statusAll,
          supplierLabel: t.purchaseOrders.filter.supplierLabel,
          supplierAll: t.purchaseOrders.filter.supplierAll,
          apply: t.purchaseOrders.filter.apply,
          clear: t.purchaseOrders.filter.clear,
        }}
      />

      {orders.length === 0 ? (
        <Card>
          <CardHeader className="items-center text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <ShoppingCart className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle>
              {filterActive
                ? t.purchaseOrders.filter.emptyFilteredTitle
                : t.purchaseOrders.emptyTitle}
            </CardTitle>
            <CardDescription>
              {filterActive
                ? t.purchaseOrders.filter.emptyFilteredBody
                : t.purchaseOrders.emptyBody}
            </CardDescription>
          </CardHeader>
          {!filterActive && canCreate ? (
            <CardContent className="flex justify-center">
              <Button asChild>
                <Link href="/purchase-orders/new">
                  <Plus className="h-4 w-4" />
                  {t.purchaseOrders.emptyCta}
                </Link>
              </Button>
            </CardContent>
          ) : null}
        </Card>
      ) : (
        <>
          <div className="text-muted-foreground flex flex-col gap-1 text-xs sm:flex-row sm:items-center sm:justify-between">
            <span>{countLine}</span>
            {truncated ? (
              <span className="italic">
                {format(t.purchaseOrders.filter.truncatedNotice, { limit })}
              </span>
            ) : null}
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.purchaseOrders.columnPoNumber}</TableHead>
                    <TableHead>{t.purchaseOrders.columnSupplier}</TableHead>
                    <TableHead>{t.purchaseOrders.columnWarehouse}</TableHead>
                    <TableHead>{t.purchaseOrders.columnStatus}</TableHead>
                    <TableHead className="text-right">{t.purchaseOrders.columnTotal}</TableHead>
                    <TableHead>{t.purchaseOrders.columnOrderDate}</TableHead>
                    <TableHead>{t.purchaseOrders.columnExpected}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((po) => {
                    let total = 0;
                    for (const line of po.lines) {
                      total += line.orderedQty * Number(line.unitCost);
                    }
                    return (
                      <TableRow key={po.id}>
                        <TableCell className="font-mono text-xs">
                          <Link href={`/purchase-orders/${po.id}`} className="hover:underline">
                            {po.poNumber}
                          </Link>
                        </TableCell>
                        <TableCell>{po.supplier.name}</TableCell>
                        <TableCell className="text-muted-foreground">{po.warehouse.name}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              po.status === "RECEIVED"
                                ? "default"
                                : po.status === "CANCELLED"
                                  ? "secondary"
                                  : "outline"
                            }
                          >
                            {t.purchaseOrders.statusBadge[po.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(total, {
                            locale: region.numberLocale,
                            currency: po.currency,
                          })}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDateOrDash(po.orderedAt, region.numberLocale)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDateOrDash(po.expectedAt, region.numberLocale)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
