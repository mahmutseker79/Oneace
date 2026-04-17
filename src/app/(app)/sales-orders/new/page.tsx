// Create sales order page
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSalesOrderAction } from "../actions";

export default function NewSalesOrderPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const result = await createSalesOrderAction(formData);

    if (result.ok) {
      router.push(`/sales-orders/${result.id}`);
    } else {
      setError(result.error);
    }
    setIsLoading(false);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-3xl font-bold">Create Sales Order</h1>

      <form onSubmit={handleSubmit} className="space-y-6 bg-white rounded-lg border p-6">
        {error && (
          <div className="rounded bg-destructive-light p-4 text-sm text-destructive">{error}</div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Order Number (auto-generate if empty)
            </label>
            <Input name="orderNumber" placeholder="SO-0001" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Required Date</label>
            <Input name="requiredDate" type="date" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Customer Name</label>
          <Input name="customerName" placeholder="Acme Corporation" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Customer Reference</label>
          <Input name="customerRef" placeholder="PO-2024-001" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Note</label>
          <Textarea name="note" placeholder="Additional notes..." rows={4} />
        </div>

        <div className="flex gap-4">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Creating..." : "Create Order"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
