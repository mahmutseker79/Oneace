"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { CreateTransferInput } from "@/lib/validation/stock-transfer";

import { createTransferAction } from "../actions";

type Warehouse = {
  id: string;
  name: string;
  code: string;
};

interface CreateTransferFormProps {
  warehouses: Warehouse[];
}

export function CreateTransferForm({ warehouses }: CreateTransferFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fromWarehouseId, setFromWarehouseId] = useState("");
  const [toWarehouseId, setToWarehouseId] = useState("");
  const [note, setNote] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const input: CreateTransferInput = {
        fromWarehouseId,
        toWarehouseId,
        note: note ?? null,
      };

      const result = await createTransferAction(input);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      // Redirect to detail page to add lines
      router.push(`/transfers/${result.id}`);
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const canSubmit =
    fromWarehouseId &&
    toWarehouseId &&
    fromWarehouseId !== toWarehouseId &&
    !isLoading;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium">Source Warehouse</label>
        <Select value={fromWarehouseId} onValueChange={setFromWarehouseId}>
          <SelectTrigger>
            <SelectValue placeholder="Select source warehouse" />
          </SelectTrigger>
          <SelectContent>
            {warehouses.map((wh) => (
              <SelectItem key={wh.id} value={wh.id}>
                {wh.name} {wh.code && `(${wh.code})`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Destination Warehouse</label>
        <Select value={toWarehouseId} onValueChange={setToWarehouseId}>
          <SelectTrigger>
            <SelectValue placeholder="Select destination warehouse" />
          </SelectTrigger>
          <SelectContent>
            {warehouses.map((wh) => (
              <SelectItem key={wh.id} value={wh.id}>
                {wh.name} {wh.code && `(${wh.code})`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Note (optional)</label>
        <Textarea
          placeholder="Add any notes about this transfer..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
        />
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={!canSubmit}>
          {isLoading ? "Creating..." : "Create Transfer"}
        </Button>
      </div>
    </form>
  );
}
