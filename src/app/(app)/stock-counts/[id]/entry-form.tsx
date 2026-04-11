"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { addCountEntryAction } from "../actions";

export type ScopeOption = {
  itemId: string;
  warehouseId: string;
  itemLabel: string;
  warehouseLabel: string;
};

export type EntryFormLabels = {
  heading: string;
  item: string;
  itemPlaceholder: string;
  warehouse: string;
  warehousePlaceholder: string;
  quantity: string;
  note: string;
  notePlaceholder: string;
  submit: string;
  error: string;
};

type EntryFormProps = {
  countId: string;
  scope: ScopeOption[];
  labels: EntryFormLabels;
};

// The scope list is a flat (item × warehouse) cartesian produced by the
// server. We split the cascade into two selects so a counter can pick
// the item first, and the warehouse dropdown narrows to the warehouses
// that actually have this item in scope.
export function EntryForm({ countId, scope, labels }: EntryFormProps) {
  const router = useRouter();
  const [itemId, setItemId] = useState<string>("");
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [countedQuantity, setCountedQuantity] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const itemOptions = Array.from(
    new Map(scope.map((row) => [row.itemId, row.itemLabel])).entries(),
  );
  const warehouseOptions = scope.filter((row) => row.itemId === itemId);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (itemId === "" || warehouseId === "" || countedQuantity === "") {
      setError(labels.error);
      return;
    }

    const payload = {
      countId,
      itemId,
      warehouseId,
      countedQuantity: Number(countedQuantity),
      note,
    };

    startTransition(async () => {
      const result = await addCountEntryAction(payload);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Reset qty + note but keep item so the counter can hammer the
      // same SKU rapidly across multiple bin locations.
      setCountedQuantity("");
      setNote("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-sm font-semibold">{labels.heading}</h3>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="entry-item">{labels.item}</Label>
          <Select
            value={itemId}
            onValueChange={(v) => {
              setItemId(v);
              setWarehouseId("");
            }}
          >
            <SelectTrigger id="entry-item">
              <SelectValue placeholder={labels.itemPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {itemOptions.map(([id, label]) => (
                <SelectItem key={id} value={id}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="entry-warehouse">{labels.warehouse}</Label>
          <Select value={warehouseId} onValueChange={setWarehouseId} disabled={itemId === ""}>
            <SelectTrigger id="entry-warehouse">
              <SelectValue placeholder={labels.warehousePlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {warehouseOptions.map((row) => (
                <SelectItem key={row.warehouseId} value={row.warehouseId}>
                  {row.warehouseLabel}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="entry-qty">{labels.quantity}</Label>
          <Input
            id="entry-qty"
            type="number"
            min={0}
            step={1}
            value={countedQuantity}
            onChange={(event) => setCountedQuantity(event.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="entry-note">{labels.note}</Label>
          <Textarea
            id="entry-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={labels.notePlaceholder}
            rows={1}
            maxLength={1000}
          />
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={isPending || itemId === "" || warehouseId === "" || countedQuantity === ""}
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {labels.submit}
        </Button>
      </div>
    </form>
  );
}
