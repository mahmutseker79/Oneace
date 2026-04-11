"use client";

import { Filter, Search, X } from "lucide-react";
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

type StatusOption = { value: string; label: string };
type SupplierOption = { id: string; name: string };

type PurchaseOrdersFilterBarLabels = {
  heading: string;
  poNumberLabel: string;
  poNumberPlaceholder: string;
  statusLabel: string;
  statusAll: string;
  supplierLabel: string;
  supplierAll: string;
  apply: string;
  clear: string;
};

type PurchaseOrdersFilterBarProps = {
  initialStatus: string;
  initialSupplier: string;
  initialQ: string;
  statusOptions: StatusOption[];
  supplierOptions: SupplierOption[];
  labels: PurchaseOrdersFilterBarLabels;
};

// Sentinels — the Select primitive rejects an empty string as an
// item value, so each "All …" row gets a distinct token that we
// translate back to an empty query param on submit.
const STATUS_ALL = "__all__";
const SUPPLIER_ALL = "__all__";

/**
 * Filter bar above the /purchase-orders table. Submits via
 * `router.push` for the same reason the movements filter bar does
 * (Sprint 14): filtering is pure read state, the URL is the source
 * of truth, and a server action would be the wrong shape for
 * something with no mutation.
 *
 * The PO-number input is a plain `<input type="search">` — not a
 * `<form method="get">` — so the Enter key still submits through
 * `handleSubmit` and picks up the current status/supplier values.
 */
export function PurchaseOrdersFilterBar({
  initialStatus,
  initialSupplier,
  initialQ,
  statusOptions,
  supplierOptions,
  labels,
}: PurchaseOrdersFilterBarProps) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus || STATUS_ALL);
  const [supplier, setSupplier] = useState(initialSupplier || SUPPLIER_ALL);
  const [q, setQ] = useState(initialQ);

  const hasFilter = Boolean(initialStatus || initialSupplier || initialQ);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (status && status !== STATUS_ALL) params.set("status", status);
    if (supplier && supplier !== SUPPLIER_ALL) params.set("supplier", supplier);
    const trimmedQ = q.trim();
    if (trimmedQ) params.set("q", trimmedQ);
    const qs = params.toString();
    router.push(qs ? `/purchase-orders?${qs}` : "/purchase-orders");
  }

  function handleClear() {
    setStatus(STATUS_ALL);
    setSupplier(SUPPLIER_ALL);
    setQ("");
    router.push("/purchase-orders");
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

      <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
        <div className="space-y-1">
          <Label htmlFor="po-filter-q" className="text-xs">
            {labels.poNumberLabel}
          </Label>
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2" />
            <Input
              id="po-filter-q"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={labels.poNumberPlaceholder}
              className="pl-8"
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="po-filter-status" className="text-xs">
            {labels.statusLabel}
          </Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger id="po-filter-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={STATUS_ALL}>{labels.statusAll}</SelectItem>
              {statusOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="po-filter-supplier" className="text-xs">
            {labels.supplierLabel}
          </Label>
          <Select value={supplier} onValueChange={setSupplier}>
            <SelectTrigger id="po-filter-supplier">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SUPPLIER_ALL}>{labels.supplierAll}</SelectItem>
              {supplierOptions.map((opt) => (
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
    </form>
  );
}
