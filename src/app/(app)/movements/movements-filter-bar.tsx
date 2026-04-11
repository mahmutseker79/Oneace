"use client";

import { Filter, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

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

type TypeOption = { value: string; label: string };
type WarehouseOption = { id: string; name: string };

type MovementsFilterBarLabels = {
  heading: string;
  fromLabel: string;
  toLabel: string;
  typeLabel: string;
  typeAll: string;
  warehouseLabel: string;
  warehouseAll: string;
  apply: string;
  clear: string;
  invalidRange: string;
};

type MovementsFilterBarProps = {
  initialFrom: string;
  initialTo: string;
  initialType: string;
  initialWarehouse: string;
  typeOptions: TypeOption[];
  warehouseOptions: WarehouseOption[];
  labels: MovementsFilterBarLabels;
};

// Sentinel values for the "All …" options. The Select primitive
// rejects an empty string as an item value, so each axis gets a
// distinct token translated to an empty query param on submit.
const TYPE_ALL = "__all__";
const WAREHOUSE_ALL = "__all__";

/**
 * Filter bar that lives above the movements table and the CSV export
 * button. Submits via `router.push` rather than a native `<form
 * method="get">` because we want to mutate search params without
 * re-exporting cookies or bouncing through a new navigation frame,
 * and because `router.push` gives us a chance to block invalid state
 * (start > end) before it reaches the server.
 *
 * We don't use server actions here because the filter is pure read
 * state — the URL is the source of truth, and the server page reads
 * it back out of searchParams on the next render. Server actions
 * would be the wrong shape for something with no mutation.
 *
 * Accessibility: the two date inputs are a simple
 * `<input type="date">`, which speaks `YYYY-MM-DD` in every locale
 * even though its visible formatting follows the user's OS locale.
 * That's exactly the wire format our `parseMovementFilter` expects,
 * so there's no client-side conversion. Screen readers pick up the
 * `<label for>` linkage cleanly.
 */
export function MovementsFilterBar({
  initialFrom,
  initialTo,
  initialType,
  initialWarehouse,
  typeOptions,
  warehouseOptions,
  labels,
}: MovementsFilterBarProps) {
  const router = useRouter();
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [typeValue, setTypeValue] = useState(initialType || TYPE_ALL);
  const [warehouseValue, setWarehouseValue] = useState(initialWarehouse || WAREHOUSE_ALL);
  const [error, setError] = useState<string | null>(null);

  const hasFilter = Boolean(initialFrom || initialTo || initialType || initialWarehouse);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    // Client-side sanity check: start must be ≤ end. parseMovementFilter
    // also defends on the server, so this is UX polish, not security.
    if (from && to && from > to) {
      setError(labels.invalidRange);
      return;
    }

    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (typeValue && typeValue !== TYPE_ALL) params.set("type", typeValue);
    if (warehouseValue && warehouseValue !== WAREHOUSE_ALL) {
      params.set("warehouse", warehouseValue);
    }
    const qs = params.toString();
    router.push(qs ? `/movements?${qs}` : "/movements");
  }

  function handleClear() {
    setFrom("");
    setTo("");
    setTypeValue(TYPE_ALL);
    setWarehouseValue(WAREHOUSE_ALL);
    setError(null);
    router.push("/movements");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-card flex flex-col gap-3 rounded-lg border p-4"
      aria-label={labels.heading}
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        <Filter className="text-muted-foreground h-4 w-4" />
        <span>{labels.heading}</span>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_1fr_auto] md:items-end">
        <div className="space-y-1">
          <Label htmlFor="movements-filter-from" className="text-xs">
            {labels.fromLabel}
          </Label>
          <Input
            id="movements-filter-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            max={to || undefined}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="movements-filter-to" className="text-xs">
            {labels.toLabel}
          </Label>
          <Input
            id="movements-filter-to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            min={from || undefined}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="movements-filter-type" className="text-xs">
            {labels.typeLabel}
          </Label>
          <Select value={typeValue} onValueChange={setTypeValue}>
            <SelectTrigger id="movements-filter-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TYPE_ALL}>{labels.typeAll}</SelectItem>
              {typeOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="movements-filter-warehouse" className="text-xs">
            {labels.warehouseLabel}
          </Label>
          <Select value={warehouseValue} onValueChange={setWarehouseValue}>
            <SelectTrigger id="movements-filter-warehouse">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={WAREHOUSE_ALL}>{labels.warehouseAll}</SelectItem>
              {warehouseOptions.map((opt) => (
                <SelectItem key={opt.id} value={opt.id}>
                  {opt.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2 md:justify-end">
          <Button type="submit" size="sm">
            {labels.apply}
          </Button>
          {hasFilter ? (
            <Button type="button" size="sm" variant="ghost" onClick={handleClear}>
              <X className="h-3.5 w-3.5" />
              {labels.clear}
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="border-destructive/50 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
        >
          {error}
        </div>
      ) : null}
    </form>
  );
}
