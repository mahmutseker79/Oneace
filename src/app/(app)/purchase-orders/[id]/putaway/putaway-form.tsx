"use client";

import { CheckCircle2, Loader2, PackageOpen, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PutawayInput } from "@/lib/validation/putaway";

import { putawayAction } from "./actions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PutawayItem = {
  itemId: string;
  itemName: string;
  itemSku: string;
  /** Total quantity unbinned at this warehouse (binId=null). */
  unbinnedQty: number;
};

export type BinOption = {
  id: string;
  code: string;
  label: string | null;
};

export type PutawayFormLabels = {
  heading: string;
  subtitle: string;
  columnItem: string;
  columnSku: string;
  columnUnbinned: string;
  columnBin: string;
  columnQty: string;
  binPlaceholder: string;
  noBins: string;
  noUnbinnedStock: string;
  submit: string;
  submitting: string;
  cancel: string;
  successTitle: string;
  successBody: (count: number) => string;
  viewPo: string;
  overAssignError: string;
  nothingToAssign: string;
  genericError: string;
};

type PutawayFormProps = {
  warehouseId: string;
  purchaseOrderId: string;
  backHref: string;
  items: PutawayItem[];
  bins: BinOption[];
  labels: PutawayFormLabels;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PutawayForm({
  warehouseId,

  backHref,
  items,
  bins,
  labels,
}: PutawayFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Per-item: which bin selected, and how many to put away.
  const [selectedBin, setSelectedBin] = useState<Record<string, string>>({});
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ count: number } | null>(null);

  // Track total assigned per item across all rows to validate.
  const assignedByItem = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      const qty = Number(quantities[item.itemId] ?? "0") || 0;
      map.set(item.itemId, qty);
    }
    return map;
  }, [items, quantities]);

  function updateQuantity(itemId: string, value: string) {
    if (value !== "" && !/^\d+$/.test(value)) return;
    setQuantities((prev) => ({ ...prev, [itemId]: value }));
  }

  function handleFillAll() {
    const nextQty: Record<string, string> = {};
    const nextBin: Record<string, string> = {};
    for (const item of items) {
      if (item.unbinnedQty > 0) {
        nextQty[item.itemId] = String(item.unbinnedQty);
        // Auto-select first bin if none selected.
        if (!selectedBin[item.itemId] && bins[0]) {
          nextBin[item.itemId] = bins[0].id;
        }
      }
    }
    setQuantities((prev) => ({ ...prev, ...nextQty }));
    setSelectedBin((prev) => ({ ...prev, ...nextBin }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    // Build lines — only rows with a bin selected and qty > 0.
    const lines = items
      .map((item) => {
        const bin = selectedBin[item.itemId];
        const rawQty = quantities[item.itemId] ?? "";
        const qty = rawQty === "" ? 0 : Math.trunc(Number(rawQty));
        return bin && qty > 0 ? { itemId: item.itemId, toBinId: bin, quantity: qty } : null;
      })
      .filter((l): l is NonNullable<typeof l> => l !== null);

    if (lines.length === 0) {
      setError(labels.nothingToAssign);
      return;
    }

    // Client-side over-assignment guard.
    for (const item of items) {
      const assigned = assignedByItem.get(item.itemId) ?? 0;
      if (assigned > item.unbinnedQty) {
        setError(
          `${labels.overAssignError}: "${item.itemName}" has ${item.unbinnedQty} unbinned, you assigned ${assigned}.`,
        );
        return;
      }
    }

    const input: PutawayInput = { warehouseId, lines };
    const idempotencyKeys = lines.map(() => generateIdempotencyKey());

    startTransition(async () => {
      const result = await putawayAction(input, idempotencyKeys);
      if (result.ok) {
        setSuccess({ count: result.movementIds.length });
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  // ── Success screen ──────────────────────────────────────────────────────

  if (success) {
    return (
      <div className="rounded-md border border-success bg-success-light p-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-success" />
          <div className="flex-1 space-y-2">
            <h2 className="text-base font-semibold text-success">{labels.successTitle}</h2>
            <p className="text-sm text-success/80">{labels.successBody(success.count)}</p>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" asChild>
                <a href={backHref}>{labels.viewPo}</a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── No bins guard ───────────────────────────────────────────────────────
  // Sprint 15 PR #1 (UX/UI audit Apr-25 §B-7): inline empty pattern → EmptyState.

  if (bins.length === 0) {
    return (
      <EmptyState
        icon={PackageOpen}
        title={labels.noBins}
        variant="unavailable"
      />
    );
  }

  // ── No unbinned stock guard ─────────────────────────────────────────────
  // Sprint 15 PR #1: inline empty + action button → EmptyState w/ actions.
  // NOT semantically "empty" — completion state — but EmptyState is the closest
  // shared primitive. Future EmptyState `completed` variant could re-introduce
  // success styling; tracked in Sprint 16+ backlog.

  const hasAnyUnbinned = items.some((i) => i.unbinnedQty > 0);
  if (!hasAnyUnbinned) {
    return (
      <EmptyState
        icon={CheckCircle2}
        title={labels.noUnbinnedStock}
        actions={[{ label: labels.viewPo, href: backHref, variant: "secondary" }]}
      />
    );
  }

  // ── Putaway table ───────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{labels.columnItem}</TableHead>
              <TableHead className="hidden sm:table-cell">{labels.columnSku}</TableHead>
              <TableHead className="text-right">{labels.columnUnbinned}</TableHead>
              <TableHead>{labels.columnBin}</TableHead>
              <TableHead className="w-[120px] text-right">{labels.columnQty}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const isClosed = item.unbinnedQty <= 0;
              const assigned = assignedByItem.get(item.itemId) ?? 0;
              const overAssigned = assigned > item.unbinnedQty;
              return (
                <TableRow key={item.itemId} className={isClosed ? "opacity-50" : undefined}>
                  <TableCell className="font-medium">{item.itemName}</TableCell>
                  <TableCell className="hidden font-mono text-xs sm:table-cell">
                    {item.itemSku}
                  </TableCell>
                  <TableCell className="text-right font-mono">{item.unbinnedQty}</TableCell>
                  <TableCell>
                    <Select
                      value={selectedBin[item.itemId] ?? ""}
                      onValueChange={(v) =>
                        setSelectedBin((prev) => ({ ...prev, [item.itemId]: v }))
                      }
                      disabled={isClosed || isPending}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder={labels.binPlaceholder} />
                      </SelectTrigger>
                      <SelectContent>
                        {bins.map((bin) => (
                          <SelectItem key={bin.id} value={bin.id}>
                            {bin.code}
                            {bin.label ? (
                              <span className="ml-1.5 text-xs text-muted-foreground">
                                {bin.label}
                              </span>
                            ) : null}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end gap-0.5">
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={quantities[item.itemId] ?? ""}
                        onChange={(e) => updateQuantity(item.itemId, e.target.value)}
                        disabled={isClosed || isPending}
                        placeholder={isClosed ? "—" : "0"}
                        className={[
                          "h-8 text-right font-mono text-sm w-20",
                          overAssigned ? "border-destructive" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        aria-label={`${labels.columnQty} — ${item.itemName}`}
                      />
                      {overAssigned ? (
                        <div className="flex items-center gap-0.5 text-xs text-destructive">
                          <TriangleAlert className="h-3 w-3" />
                          <span>max {item.unbinnedQty}</span>
                        </div>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleFillAll}
          disabled={!hasAnyUnbinned || isPending}
        >
          <PackageOpen className="h-4 w-4" />
          Fill all
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" asChild disabled={isPending}>
          <a href={backHref}>{labels.cancel}</a>
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {labels.submitting}
            </>
          ) : (
            labels.submit
          )}
        </Button>
      </div>
    </form>
  );
}
