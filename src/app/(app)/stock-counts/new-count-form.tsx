"use client";

import { ChevronDown, Loader2, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { createStockCountAction } from "./actions";

export type NewCountFormLabels = {
  name: string;
  namePlaceholder: string;
  methodology: string;
  methodologyOptions: Record<
    "CYCLE" | "FULL" | "SPOT" | "BLIND" | "DOUBLE_BLIND" | "DIRECTED",
    string
  >;
  methodologyHelp: Record<
    "CYCLE" | "FULL" | "SPOT" | "BLIND" | "DOUBLE_BLIND" | "DIRECTED",
    string
  >;
  warehouse: string;
  warehouseAll: string;
  warehouseHelp: string;
  items: string;
  itemsSearchPlaceholder: string;
  itemsSelected: (count: number) => string;
  itemsSelectAll: string;
  itemsEmpty: string;
  itemsHint: string;
  advancedOptions: string;
  submit: string;
  cancel: string;
  genericError: string;
};

export type ItemOption = { id: string; sku: string; name: string };
export type WarehouseOption = { id: string; name: string; code: string };
export type MethodologyKey = "CYCLE" | "FULL" | "SPOT" | "BLIND" | "DOUBLE_BLIND" | "DIRECTED";

type NewCountFormProps = {
  labels: NewCountFormLabels;
  items: ItemOption[];
  warehouses: WarehouseOption[];
};

const ALL_WAREHOUSES = "__all__";

export function NewCountForm({ labels, items, warehouses }: NewCountFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  // P3.6 — Default to FULL for first-run clarity. Advanced users can expand
  // the options section to switch methodology.
  const [methodology, setMethodology] = useState<MethodologyKey>("FULL");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [warehouseId, setWarehouseId] = useState<string>(ALL_WAREHOUSES);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q === "") return items;
    return items.filter(
      (item) => item.name.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q),
    );
  }, [items, search]);

  const allVisibleSelected = filtered.length > 0 && filtered.every((item) => selected.has(item.id));

  function toggleItem(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const item of filtered) next.delete(item.id);
      } else {
        for (const item of filtered) next.add(item.id);
      }
      return next;
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (name.trim() === "") {
      setError(labels.genericError);
      return;
    }
    if (selected.size === 0) {
      setError(labels.genericError);
      return;
    }

    const payload = {
      name: name.trim(),
      methodology,
      warehouseId: warehouseId === ALL_WAREHOUSES ? "" : warehouseId,
      itemIds: Array.from(selected),
    };

    startTransition(async () => {
      const result = await createStockCountAction(payload);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/stock-counts/${result.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="count-name">{labels.name}</Label>
        <Input
          id="count-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={labels.namePlaceholder}
          maxLength={120}
          required
        />
      </div>

      {/* P3.6 — Methodology wrapped in collapsible "Advanced options" */}
      <div className="rounded-md border">
        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-accent/50 transition-colors"
        >
          <span>{labels.advancedOptions}</span>
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", advancedOpen && "rotate-180")}
          />
        </button>
        {advancedOpen ? (
          <div className="space-y-4 border-t px-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="count-methodology">{labels.methodology}</Label>
              <Select
                value={methodology}
                onValueChange={(v) => setMethodology(v as MethodologyKey)}
              >
                <SelectTrigger id="count-methodology">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FULL">{labels.methodologyOptions.FULL}</SelectItem>
                  <SelectItem value="CYCLE">{labels.methodologyOptions.CYCLE}</SelectItem>
                  <SelectItem value="SPOT">{labels.methodologyOptions.SPOT}</SelectItem>
                  <SelectItem value="BLIND">{labels.methodologyOptions.BLIND}</SelectItem>
                  <SelectItem value="DOUBLE_BLIND">
                    {labels.methodologyOptions.DOUBLE_BLIND}
                  </SelectItem>
                  <SelectItem value="DIRECTED">{labels.methodologyOptions.DIRECTED}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{labels.methodologyHelp[methodology]}</p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="count-warehouse">{labels.warehouse}</Label>
        <Select value={warehouseId} onValueChange={setWarehouseId}>
          <SelectTrigger id="count-warehouse">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_WAREHOUSES}>{labels.warehouseAll}</SelectItem>
            {warehouses.map((warehouse) => (
              <SelectItem key={warehouse.id} value={warehouse.id}>
                {warehouse.name} · {warehouse.code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{labels.warehouseHelp}</p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="count-item-search">{labels.items}</Label>
          <span className="text-xs text-muted-foreground">
            {labels.itemsSelected(selected.size)}
          </span>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="count-item-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={labels.itemsSearchPlaceholder}
            className="pl-9"
          />
        </div>
        <div className="max-h-96 overflow-y-auto rounded-md border">
          {filtered.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">{labels.itemsEmpty}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/60 backdrop-blur">
                <tr>
                  <th className="w-10 p-2 text-left">
                    <Checkbox
                      checked={allVisibleSelected}
                      onCheckedChange={toggleSelectAllVisible}
                      aria-label={labels.itemsSelectAll}
                    />
                  </th>
                  <th className="p-2 text-left font-medium">SKU</th>
                  <th className="p-2 text-left font-medium">Name</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const isSelected = selected.has(item.id);
                  // Selection is driven exclusively by the checkbox so
                  // the row stays keyboard-accessible without a custom
                  // onKeyDown handler. The checkbox's native click +
                  // space/enter keybindings handle toggle.
                  return (
                    <tr key={item.id} className="border-t hover:bg-muted/40">
                      <td className="p-2">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleItem(item.id)}
                          aria-label={item.name}
                        />
                      </td>
                      <td className="p-2 font-mono text-xs">{item.sku}</td>
                      <td className="p-2">{item.name}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{labels.itemsHint}</p>
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
        <Button type="submit" disabled={isPending || name.trim() === "" || selected.size === 0}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {labels.submit}
        </Button>
      </div>
    </form>
  );
}
