import { ChevronLeft, Package } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { requireActiveMembership } from "@/lib/session";
import { formatCurrency } from "@/lib/utils";

import { MarkSentButton } from "./mark-sent-button";

type DetailPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: DetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const t = await getMessages();
  const po = await db.purchaseOrder.findUnique({
    where: { id },
    select: { poNumber: true },
  });
  return {
    title: po
      ? `${po.poNumber} — ${t.purchaseOrders.detail.metaTitle}`
      : t.purchaseOrders.detail.metaTitle,
  };
}

function fmtDate(value: Date | null | undefined, locale: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(value);
}

export default async function PurchaseOrderDetailPage({ params }: DetailPageProps) {
  const { id } = await params;
  const { membership } = await requireActiveMembership();
  const t = await getMessages();
  const region = await getRegion();

  const po = await db.purchaseOrder.findFirst({
    where: { id, organizationId: membership.organizationId },
    include: {
      supplier: { select: { id: true, name: true, code: true } },
      warehouse: { select: { id: true, name: true, code: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      lines: {
        orderBy: { createdAt: "asc" },
        include: {
          item: { select: { id: true, sku: true, name: true } },
        },
      },
    },
  });

  if (!po) notFound();

  let total = 0;
  for (const line of po.lines) {
    total += line.orderedQty * Number(line.unitCost);
  }

  const canEdit = po.status === "DRAFT" || po.status === "SENT";
  const canReceive =
    po.status === "DRAFT" || po.status === "SENT" || po.status === "PARTIALLY_RECEIVED";
  const canMarkSent = po.status === "DRAFT";

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/purchase-orders">
            <ChevronLeft className="h-4 w-4" />
            {t.purchaseOrders.detail.backToList}
          </Link>
        </Button>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="font-mono text-2xl font-semibold">{po.poNumber}</h1>
            <p className="text-muted-foreground">{po.supplier.name}</p>
          </div>
          <div className="flex items-center gap-2">
            {canMarkSent ? (
              <MarkSentButton id={po.id} label={t.purchaseOrders.detail.sendAction} />
            ) : null}
            {canEdit ? (
              <Button variant="outline" asChild>
                <Link href={`/purchase-orders/${po.id}/edit`}>
                  {t.purchaseOrders.detail.editAction}
                </Link>
              </Button>
            ) : null}
            {canReceive ? (
              <Button asChild>
                <Link href={`/purchase-orders/${po.id}/receive`}>
                  <Package className="h-4 w-4" />
                  {t.purchaseOrders.detail.receiveAction}
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {t.purchaseOrders.detail.metaStatus}
            </CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {t.purchaseOrders.detail.metaOrderDate}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {fmtDate(po.orderedAt, region.numberLocale)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {t.purchaseOrders.detail.metaExpectedDate}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {fmtDate(po.expectedAt, region.numberLocale)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {t.purchaseOrders.detail.metaWarehouse}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {po.warehouse.name} <span className="text-muted-foreground">· {po.warehouse.code}</span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t.purchaseOrders.detail.linesHeading}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.purchaseOrders.detail.columnItem}</TableHead>
                <TableHead>{t.purchaseOrders.detail.columnSku}</TableHead>
                <TableHead className="text-right">
                  {t.purchaseOrders.detail.columnOrdered}
                </TableHead>
                <TableHead className="text-right">
                  {t.purchaseOrders.detail.columnReceived}
                </TableHead>
                <TableHead className="text-right">{t.purchaseOrders.detail.columnOpen}</TableHead>
                <TableHead className="text-right">
                  {t.purchaseOrders.detail.columnUnitCost}
                </TableHead>
                <TableHead className="text-right">
                  {t.purchaseOrders.detail.columnLineTotal}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {po.lines.map((line) => {
                const unit = Number(line.unitCost);
                const open = line.orderedQty - line.receivedQty;
                return (
                  <TableRow key={line.id}>
                    <TableCell className="font-medium">{line.item.name}</TableCell>
                    <TableCell className="font-mono text-xs">{line.item.sku}</TableCell>
                    <TableCell className="text-right font-mono">{line.orderedQty}</TableCell>
                    <TableCell className="text-right font-mono">{line.receivedQty}</TableCell>
                    <TableCell className="text-right font-mono">{open}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(unit, { locale: region.numberLocale, currency: po.currency })}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(line.orderedQty * unit, {
                        locale: region.numberLocale,
                        currency: po.currency,
                      })}
                    </TableCell>
                  </TableRow>
                );
              })}
              <TableRow>
                <TableCell colSpan={6} className="text-right font-semibold">
                  {t.purchaseOrders.totalsLabel}
                </TableCell>
                <TableCell className="text-right font-mono font-semibold">
                  {formatCurrency(total, { locale: region.numberLocale, currency: po.currency })}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {po.notes ? (
        <Card>
          <CardHeader>
            <CardTitle>{t.purchaseOrders.detail.notesHeading}</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm">{po.notes}</CardContent>
        </Card>
      ) : null}
    </div>
  );
}
