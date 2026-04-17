import { ChevronLeft, Package, Truck } from "lucide-react";
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
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";

import {
  allocateSalesOrderAction,
  cancelSalesOrderAction,
  confirmSalesOrderAction,
} from "../actions";

export const metadata: Metadata = {
  title: "Sales Order",
};

function statusBadge(status: string) {
  if (status === "DRAFT") return <Badge variant="outline">{status}</Badge>;
  if (status === "CONFIRMED") return <Badge variant="info">{status}</Badge>;
  if (status === "ALLOCATED") return <Badge variant="processing">{status}</Badge>;
  if (status === "PARTIALLY_SHIPPED") return <Badge variant="warning">{status}</Badge>;
  if (status === "SHIPPED") return <Badge variant="success">{status}</Badge>;
  if (status === "CANCELLED") return <Badge variant="destructive">{status}</Badge>;
  return <Badge>{status}</Badge>;
}

export default async function SalesOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { membership } = await requireActiveMembership();

  const order = await db.salesOrder.findFirst({
    where: { id, organizationId: membership.organizationId },
    include: {
      lines: {
        select: {
          id: true,
          itemId: true,
          variantId: true,
          warehouseId: true,
          orderedQty: true,
          allocatedQty: true,
          shippedQty: true,
        },
      },
    },
  });

  if (!order) notFound();

  const canEdit = hasCapability(membership.role, "salesOrders.edit");
  const totalQty = order.lines.reduce((s, l) => s + l.orderedQty, 0);
  const totalAllocated = order.lines.reduce((s, l) => s + l.allocatedQty, 0);
  const totalShipped = order.lines.reduce((s, l) => s + l.shippedQty, 0);

  return (
    <div className="space-y-6 max-w-4xl">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/sales-orders">
          <ChevronLeft className="h-4 w-4" />
          Back to sales orders
        </Link>
      </Button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{order.orderNumber}</h1>
          <p className="text-muted-foreground">
            {order.customerName || "No customer"}{" "}
            {order.customerRef && `· Ref: ${order.customerRef}`}
          </p>
        </div>
        {statusBadge(order.status)}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-normal">Lines</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{order.lines.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-normal">Total Qty</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{totalQty}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-normal">Allocated</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{totalAllocated}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-normal">Shipped</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{totalShipped}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Order Lines</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead className="text-right">Ordered</TableHead>
                <TableHead className="text-right">Allocated</TableHead>
                <TableHead className="text-right">Shipped</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell>
                    <Link href={`/items/${line.itemId}`} className="font-medium hover:underline">
                      {line.itemId.slice(0, 8)}...
                    </Link>
                    {line.variantId && (
                      <span className="text-xs text-muted-foreground ml-1">
                        ({line.variantId.slice(0, 6)})
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {line.warehouseId.slice(0, 8)}...
                  </TableCell>
                  <TableCell className="text-right font-mono">{line.orderedQty}</TableCell>
                  <TableCell className="text-right font-mono">{line.allocatedQty}</TableCell>
                  <TableCell className="text-right font-mono">{line.shippedQty}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Action buttons wired to server actions */}
      <div className="flex gap-3 flex-wrap">
        {order.status === "DRAFT" && canEdit && (
          <>
            <form
              action={async () => {
                "use server";
                await confirmSalesOrderAction(order.id);
              }}
            >
              <Button type="submit">
                <Package className="h-4 w-4 mr-1" /> Confirm Order
              </Button>
            </form>
            <form
              action={async () => {
                "use server";
                const fd = new FormData();
                fd.set("id", order.id);
                await cancelSalesOrderAction(fd);
              }}
            >
              <Button type="submit" variant="destructive">
                Cancel
              </Button>
            </form>
          </>
        )}
        {order.status === "CONFIRMED" && canEdit && (
          <form
            action={async () => {
              "use server";
              const fd = new FormData();
              fd.set("id", order.id);
              await allocateSalesOrderAction(fd);
            }}
          >
            <Button type="submit">
              <Package className="h-4 w-4 mr-1" /> Allocate Stock
            </Button>
          </form>
        )}
        {(order.status === "ALLOCATED" || order.status === "PARTIALLY_SHIPPED") && canEdit && (
          <Button asChild>
            <Link href={`/sales-orders/${order.id}/ship`}>
              <Truck className="h-4 w-4 mr-1" /> Ship Order
            </Link>
          </Button>
        )}
      </div>

      {order.note && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-normal">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{order.note}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
