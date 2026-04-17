"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AddTransferLineInput } from "@/lib/validation/stock-transfer";

import { addTransferLineAction } from "../../actions";

type Item = {
  id: string;
  sku: string;
  name: string;
};

interface AddLineFormProps {
  transferId: string;
  items: Item[];
}

export function AddLineForm({ transferId, items }: AddLineFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [itemId, setItemId] = useState("");
  const [shippedQty, setShippedQty] = useState<number | "">(1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (!itemId || typeof shippedQty !== "number" || shippedQty < 1) {
        setError("Please fill in all required fields");
        setIsLoading(false);
        return;
      }

      const input: AddTransferLineInput = {
        transferId,
        itemId,
        shippedQty,
      };

      const result = await addTransferLineAction(input);

      if (!result.ok) {
        setError(result.error);
        setIsLoading(false);
        return;
      }

      // Redirect back to transfer detail
      router.push(`/transfers/${transferId}`);
    } catch (_err) {
      setError("An unexpected error occurred");
      setIsLoading(false);
    }
  };

  const canSubmit = itemId && typeof shippedQty === "number" && shippedQty >= 1 && !isLoading;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md bg-destructive-light p-3 text-sm text-destructive">{error}</div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium">Item</label>
        <Select value={itemId} onValueChange={setItemId}>
          <SelectTrigger>
            <SelectValue placeholder="Select an item" />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.name} ({item.sku})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Shipped Quantity</label>
        <Input
          type="number"
          min="1"
          max="1000000"
          value={shippedQty}
          onChange={(e) => setShippedQty(e.target.value ? Number.parseInt(e.target.value, 10) : "")}
          placeholder="Enter quantity"
          required
        />
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={!canSubmit}>
          {isLoading ? "Adding..." : "Add Item"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={isLoading}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
