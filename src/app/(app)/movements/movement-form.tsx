"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

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

import { createMovementAction } from "./actions";

export type MovementFormLabels = {
  type: string;
  typeOptions: Record<"RECEIPT" | "ISSUE" | "ADJUSTMENT" | "TRANSFER", string>;
  typeHelp: Record<"RECEIPT" | "ISSUE" | "ADJUSTMENT" | "TRANSFER", string>;
  item: string;
  itemPlaceholder: string;
  warehouse: string;
  warehouseSource: string;
  toWarehouse: string;
  quantity: string;
  direction: string;
  directionIn: string;
  directionOut: string;
  reference: string;
  referencePlaceholder: string;
  note: string;
  notePlaceholder: string;
  submit: string;
  error: string;
  cancel: string;
};

export type MovementFormOption = { id: string; label: string; sub?: string };

type MovementType = "RECEIPT" | "ISSUE" | "ADJUSTMENT" | "TRANSFER";

type MovementFormProps = {
  labels: MovementFormLabels;
  items: MovementFormOption[];
  warehouses: MovementFormOption[];
  presetItemId?: string;
  presetWarehouseId?: string;
};

export function MovementForm({
  labels,
  items,
  warehouses,
  presetItemId,
  presetWarehouseId,
}: MovementFormProps) {
  const router = useRouter();
  const [type, setType] = useState<MovementType>("RECEIPT");
  const [itemId, setItemId] = useState<string>(presetItemId ?? "");
  const [warehouseId, setWarehouseId] = useState<string>(
    presetWarehouseId ?? warehouses[0]?.id ?? "",
  );
  const [toWarehouseId, setToWarehouseId] = useState<string>("");
  const [direction, setDirection] = useState<"1" | "-1">("1");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const destinationOptions = useMemo(
    () => warehouses.filter((w) => w.id !== warehouseId),
    [warehouses, warehouseId],
  );

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("type", type);
    formData.set("itemId", itemId);
    formData.set("warehouseId", warehouseId);
    if (type === "TRANSFER") {
      formData.set("toWarehouseId", toWarehouseId);
    } else {
      formData.delete("toWarehouseId");
    }
    if (type === "ADJUSTMENT") {
      formData.set("direction", direction);
    } else {
      formData.delete("direction");
    }

    startTransition(async () => {
      const result = await createMovementAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/movements");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Type selector */}
      <div className="space-y-2">
        <Label htmlFor="movement-type">{labels.type}</Label>
        <Select value={type} onValueChange={(v) => setType(v as MovementType)}>
          <SelectTrigger id="movement-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="RECEIPT">{labels.typeOptions.RECEIPT}</SelectItem>
            <SelectItem value="ISSUE">{labels.typeOptions.ISSUE}</SelectItem>
            <SelectItem value="ADJUSTMENT">{labels.typeOptions.ADJUSTMENT}</SelectItem>
            <SelectItem value="TRANSFER">{labels.typeOptions.TRANSFER}</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{labels.typeHelp[type]}</p>
      </div>

      {/* Item */}
      <div className="space-y-2">
        <Label htmlFor="movement-item">{labels.item}</Label>
        <Select value={itemId} onValueChange={setItemId}>
          <SelectTrigger id="movement-item">
            <SelectValue placeholder={labels.itemPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.label}
                {item.sub ? (
                  <span className="ml-2 text-xs text-muted-foreground">{item.sub}</span>
                ) : null}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Source warehouse */}
      <div className="space-y-2">
        <Label htmlFor="movement-warehouse">
          {type === "TRANSFER" ? labels.warehouseSource : labels.warehouse}
        </Label>
        <Select value={warehouseId} onValueChange={setWarehouseId}>
          <SelectTrigger id="movement-warehouse">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {warehouses.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                {w.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Destination warehouse — only for TRANSFER */}
      {type === "TRANSFER" ? (
        <div className="space-y-2">
          <Label htmlFor="movement-to-warehouse">{labels.toWarehouse}</Label>
          <Select value={toWarehouseId} onValueChange={setToWarehouseId}>
            <SelectTrigger id="movement-to-warehouse">
              <SelectValue placeholder={labels.toWarehouse} />
            </SelectTrigger>
            <SelectContent>
              {destinationOptions.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {/* Direction — only for ADJUSTMENT */}
      {type === "ADJUSTMENT" ? (
        <div className="space-y-2">
          <Label htmlFor="movement-direction">{labels.direction}</Label>
          <Select value={direction} onValueChange={(v) => setDirection(v as "1" | "-1")}>
            <SelectTrigger id="movement-direction">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">{labels.directionIn}</SelectItem>
              <SelectItem value="-1">{labels.directionOut}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {/* Quantity */}
      <div className="space-y-2">
        <Label htmlFor="movement-quantity">{labels.quantity}</Label>
        <Input id="movement-quantity" name="quantity" type="number" min={1} step={1} required />
      </div>

      {/* Reference */}
      <div className="space-y-2">
        <Label htmlFor="movement-reference">{labels.reference}</Label>
        <Input
          id="movement-reference"
          name="reference"
          type="text"
          placeholder={labels.referencePlaceholder}
          maxLength={120}
        />
      </div>

      {/* Note */}
      <div className="space-y-2">
        <Label htmlFor="movement-note">{labels.note}</Label>
        <Textarea
          id="movement-note"
          name="note"
          placeholder={labels.notePlaceholder}
          maxLength={1000}
          rows={3}
        />
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={isPending}>
          {labels.cancel}
        </Button>
        <Button type="submit" disabled={isPending || !itemId || !warehouseId}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {labels.submit}
        </Button>
      </div>
    </form>
  );
}
