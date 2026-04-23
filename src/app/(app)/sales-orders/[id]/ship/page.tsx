// Ship sales order page
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { shipSalesOrderAction } from "../../actions";

// GOD MODE roadmap P0-02 rc3 — per-form-mount idempotency key.
// `useRef` stabilises the UUID across re-renders so a React Strict
// Mode double-render and the user's own double-click both submit the
// SAME key. The server's withIdempotency wrapper then returns the
// cached ActionResult on the second attempt instead of re-running the
// ship transaction.
//
// `crypto.randomUUID` is ambient on modern browsers (HTTPS origins
// + localhost). The fallback path is guarded so older environments
// still degrade to pass-through (no caching, pre-rc2 behaviour).
function mintIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Degraded fallback — sufficient entropy for the 24h TTL window.
  return `ship-so-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

interface SalesOrderLine {
  id: string;
  itemId: string;
  warehouseId: string;
  orderedQty: number;
  shippedQty: number;
  allocatedQty: number;
}

interface SalesOrder {
  id: string;
  orderNumber: string;
  lines: SalesOrderLine[];
}

export default function ShipSalesOrderPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [order] = useState<SalesOrder | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // P0-02 rc3 — one key per form mount. Survives double-submit,
  // React Strict Mode re-renders, and user double-click.
  const idempotencyKeyRef = useRef<string>(mintIdempotencyKey());

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("salesOrderId", params.id);
    formData.append(
      "lines",
      JSON.stringify(
        order?.lines.map((line) => ({
          lineId: line.id,
          shippedQty: quantities[line.id] || 0,
        })) || [],
      ),
    );
    // P0-02 rc3 — server's shipSalesOrderSchema consumes this field.
    formData.append("idempotencyKey", idempotencyKeyRef.current);

    const result = await shipSalesOrderAction(formData);

    if (result.ok) {
      router.push(`/sales-orders/${result.id}`);
    } else {
      setError(result.error);
    }
    setIsLoading(false);
  }

  if (!order) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-3xl font-bold">Ship: {order.orderNumber}</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded bg-destructive-light p-4 text-sm text-destructive">{error}</div>
        )}

        <div className="rounded-lg border overflow-hidden">
          <div className="bg-muted/50 border-b px-6 py-3">
            <h2 className="font-semibold">Ship Quantities</h2>
          </div>
          <table className="w-full">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium">Item</th>
                <th className="px-6 py-3 text-left text-sm font-medium">Warehouse</th>
                <th className="px-6 py-3 text-center text-sm font-medium">Ordered</th>
                <th className="px-6 py-3 text-center text-sm font-medium">Already Shipped</th>
                <th className="px-6 py-3 text-center text-sm font-medium">Remaining</th>
                <th className="px-6 py-3 text-center text-sm font-medium">Ship Now</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {order.lines?.map((line) => {
                const remaining = line.allocatedQty - line.shippedQty;
                return (
                  <tr key={line.id} className="hover:bg-muted/50">
                    <td className="px-6 py-3 text-sm font-medium">{line.itemId}</td>
                    <td className="px-6 py-3 text-sm text-muted-foreground">{line.warehouseId}</td>
                    <td className="px-6 py-3 text-sm text-center">{line.orderedQty}</td>
                    <td className="px-6 py-3 text-sm text-center">{line.shippedQty}</td>
                    <td className="px-6 py-3 text-sm text-center font-semibold">{remaining}</td>
                    <td className="px-6 py-3 text-center">
                      <Input
                        type="number"
                        min="0"
                        max={remaining}
                        defaultValue={remaining}
                        onChange={(e) =>
                          setQuantities({
                            ...quantities,
                            [line.id]: Number.parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-20 text-center"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex gap-4">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Shipping..." : "Confirm Shipment"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
