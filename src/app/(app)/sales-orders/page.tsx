import { Plus, ShoppingCart } from "lucide-react";
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
import { getMessages, getRegion } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";

type SalesOrderStatus = "DRAFT" | "CONFIRMED" | "ALLOCATED" | "SHIPPED" | "CANCELLED";
type SearchParams = Promise<{ tab?: string }>;

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Sales Orders — OneAce" };
}

export default async function SalesOrdersPage({ searchParams }: { searchParams?: SearchParams }) {
  const { membership } = await requireActiveMembership();
  const _t = await getMessages();
  const region = await getRegion();

  const params = (await searchParams) ?? {};
  const tab = (params.tab ?? "all").toLowerCase();

  // P10.1 — capability flag for conditional UI rendering
  const canCreate = hasCapability(membership.role, "salesOrders.create");

  const orders = await db.salesOrder.findMany({
    where: {
      organizationId: membership.organizationId,
      ...(tab === "draft"
        ? { status: "DRAFT" }
        : tab === "confirmed"
          ? { status: "CONFIRMED" }
          : tab === "allocated"
            ? { status: "ALLOCATED" }
            : tab === "shipped"
              ? { status: "SHIPPED" }
              : tab === "cancelled"
                ? { status: "CANCELLED" }
                : {}),
    },
    include: {
      lines: true,
      _count: { select: { lines: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const dateFormatter = new Intl.DateTimeFormat(region.numberLocale, { dateStyle: "medium" });

  function statusBadge(status: SalesOrderStatus) {
    if (status === "DRAFT") return <Badge variant="outline">{status}</Badge>;
    if (status === "CONFIRMED") return <Badge variant="info">{status}</Badge>;
    if (status === "ALLOCATED") return <Badge variant="processing">{status}</Badge>;
    if (status === "SHIPPED") return <Badge variant="success">{status}</Badge>;
    return <Badge variant="secondary">{status}</Badge>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales Orders"
        description="Manage outbound sales orders"
        actions={
          canCreate ? (
            <Button asChild>
              <Link href="/sales-orders/new">
                <Plus className="h-4 w-4" />
                New Order
              </Link>
            </Button>
          ) : null
        }
      />

      {/* Status tabs */}
      <div className="flex gap-2 border-b">
        {[
          { value: "all", label: "All" },
          { value: "draft", label: "Draft" },
          { value: "confirmed", label: "Confirmed" },
          { value: "allocated", label: "Allocated" },
          { value: "shipped", label: "Shipped" },
          { value: "cancelled", label: "Cancelled" },
        ].map((s) => (
          <Link
            key={s.value}
            href={`/sales-orders?tab=${s.value}`}
            className={`px-4 py-2 text-sm border-b-2 transition-colors ${
              tab === s.value
                ? "border-primary text-primary font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {s.label}
          </Link>
        ))}
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="No sales orders yet"
          description="Create sales orders to manage customer orders and fulfillment."
          actions={
            canCreate
              ? [
                  {
                    label: "Create order",
                    href: "/sales-orders/new",
                    icon: Plus,
                  },
                ]
              : undefined
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ResponsiveTable
              cardView={orders.map((order) => {
                const totalQty = order.lines.reduce((sum, line) => sum + line.orderedQty, 0);
                return (
                  <MobileCard
                    key={order.id}
                    title={order.orderNumber}
                    badge={statusBadge(order.status as SalesOrderStatus)}
                    href={`/sales-orders/${order.id}`}
                    fields={[
                      { label: "Lines", value: order._count.lines },
                      { label: "Total Qty", value: totalQty },
                      { label: "Date", value: dateFormatter.format(order.orderDate) },
                    ]}
                  />
                );
              })}
            >
              <Table className="min-w-[700px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Items</TableHead>
                    <TableHead className="text-right">Total Qty</TableHead>
                    <TableHead>Order Date</TableHead>
                    <TableHead>Required Date</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => {
                    const totalQty = order.lines.reduce((sum, line) => sum + line.orderedQty, 0);
                    return (
                      <TableRow key={order.id} className="hover:bg-muted/50 transition-colors">
                        <TableCell className="font-mono text-sm font-medium">
                          <Link href={`/sales-orders/${order.id}`} className="hover:underline">
                            {order.orderNumber}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm">{order.customerName || "—"}</TableCell>
                        <TableCell>{statusBadge(order.status as SalesOrderStatus)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {order._count.lines}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{totalQty}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {dateFormatter.format(order.orderDate)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {order.requiredDate ? dateFormatter.format(order.requiredDate) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/sales-orders/${order.id}`}>View</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ResponsiveTable>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
