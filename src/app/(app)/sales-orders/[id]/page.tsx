// Sales order detail page
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function SalesOrderDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useState(() => {
    // TODO: Fetch sales order by ID
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!order) {
    return <div>Sales order not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{order.orderNumber}</h1>
          <p className="text-muted-foreground">{order.customerName || "No customer"}</p>
        </div>
        <Badge variant={order.status === "DRAFT" ? "outline" : "default"}>
          {order.status}
        </Badge>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Customer Ref</p>
          <p className="font-semibold">{order.customerRef || "—"}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Required Date</p>
          <p className="font-semibold">
            {order.requiredDate ? new Date(order.requiredDate).toLocaleDateString() : "—"}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Items</p>
          <p className="font-semibold">{order.lines?.length || 0}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Total Qty</p>
          <p className="font-semibold">
            {order.lines?.reduce((sum: number, l: any) => sum + l.orderedQty, 0) || 0}
          </p>
        </div>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <div className="bg-muted/50 border-b px-6 py-3">
          <h2 className="font-semibold">Lines</h2>
        </div>
        <table className="w-full">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-medium">Item</th>
              <th className="px-6 py-3 text-left text-sm font-medium">Variant</th>
              <th className="px-6 py-3 text-left text-sm font-medium">Warehouse</th>
              <th className="px-6 py-3 text-center text-sm font-medium">Ordered</th>
              <th className="px-6 py-3 text-center text-sm font-medium">Allocated</th>
              <th className="px-6 py-3 text-center text-sm font-medium">Shipped</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {order.lines?.map((line: any) => (
              <tr key={line.id} className="hover:bg-muted/50">
                <td className="px-6 py-3 text-sm font-medium">{line.itemId}</td>
                <td className="px-6 py-3 text-sm text-muted-foreground">{line.variantId || "—"}</td>
                <td className="px-6 py-3 text-sm text-muted-foreground">{line.warehouseId}</td>
                <td className="px-6 py-3 text-sm text-center font-medium">{line.orderedQty}</td>
                <td className="px-6 py-3 text-sm text-center">{line.allocatedQty}</td>
                <td className="px-6 py-3 text-sm text-center">{line.shippedQty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-3">
        {order.status === "DRAFT" && (
          <>
            <Button>Confirm Order</Button>
            <Button variant="outline">Add Line</Button>
            <Button variant="destructive">Cancel</Button>
          </>
        )}
        {order.status === "CONFIRMED" && (
          <>
            <Button>Allocate Stock</Button>
            <Button variant="outline">Add Line</Button>
            <Button variant="destructive">Cancel</Button>
          </>
        )}
        {order.status === "ALLOCATED" && (
          <>
            <Link href={`/sales-orders/${order.id}/ship`}>
              <Button>Ship Order</Button>
            </Link>
            <Button variant="destructive">Release & Cancel</Button>
          </>
        )}
        {order.status === "PARTIALLY_SHIPPED" && (
          <>
            <Link href={`/sales-orders/${order.id}/ship`}>
              <Button>Ship Remaining</Button>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
