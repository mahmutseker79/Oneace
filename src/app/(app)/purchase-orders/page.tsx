import { Plus, ShoppingCart } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

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
import { requireActiveMembership } from "@/lib/session";
import { formatCurrency } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.purchaseOrders.metaTitle };
}

function formatDateOrDash(value: Date | null | undefined, locale: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(value);
}

export default async function PurchaseOrdersPage() {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();
  const region = await getRegion();

  const [orders, supplierCount] = await Promise.all([
    db.purchaseOrder.findMany({
      where: { organizationId: membership.organizationId },
      orderBy: { orderedAt: "desc" },
      include: {
        supplier: { select: { id: true, name: true } },
        warehouse: { select: { id: true, name: true, code: true } },
        lines: { select: { orderedQty: true, unitCost: true } },
      },
    }),
    db.supplier.count({
      where: { organizationId: membership.organizationId, isActive: true },
    }),
  ]);

  if (supplierCount === 0) {
    return (
      <div className="space-y-6">
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
          <CardContent className="flex justify-center">
            <Button asChild>
              <Link href="/suppliers/new">
                <Plus className="h-4 w-4" />
                {t.purchaseOrders.emptyNoSuppliersCta}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t.purchaseOrders.heading}</h1>
          <p className="text-muted-foreground">{t.purchaseOrders.subtitle}</p>
        </div>
        <Button asChild>
          <Link href="/purchase-orders/new">
            <Plus className="h-4 w-4" />
            {t.purchaseOrders.newPurchaseOrder}
          </Link>
        </Button>
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardHeader className="items-center text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <ShoppingCart className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle>{t.purchaseOrders.emptyTitle}</CardTitle>
            <CardDescription>{t.purchaseOrders.emptyBody}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button asChild>
              <Link href="/purchase-orders/new">
                <Plus className="h-4 w-4" />
                {t.purchaseOrders.emptyCta}
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
      )}
    </div>
  );
}
