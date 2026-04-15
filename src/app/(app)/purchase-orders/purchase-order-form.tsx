"use client";

import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { useUnsavedWarning } from "@/hooks/use-unsaved-warning";

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

import { createPurchaseOrderAction, updatePurchaseOrderAction } from "./actions";

export type PurchaseOrderFormLabels = {
  fields: {
    poNumber: string;
    poNumberHelp: string;
    supplier: string;
    supplierPlaceholder: string;
    warehouse: string;
    warehousePlaceholder: string;
    currency: string;
    orderDate: string;
    expectedDate: string;
    notes: string;
    notesPlaceholder: string;
    status: string;
    lines: string;
    linesEmpty: string;
    addLine: string;
    removeLine: string;
    lineItem: string;
    lineItemPlaceholder: string;
    lineQuantity: string;
    lineUnitCost: string;
    lineUnitCostHelp: string;
    lineLineTotal: string;
    lineNotes: string;
  };
  statusBadge: Record<"DRAFT" | "SENT" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED", string>;
  totalsLabel: string;
  common: {
    save: string;
    saveChanges: string;
    cancel: string;
    optional: string;
  };
  errors: {
    createFailed: string;
    updateFailed: string;
  };
  backHref: string;
};

type SupplierOption = {
  id: string;
  name: string;
  currency: string;
};

type WarehouseOption = {
  id: string;
  name: string;
  code: string;
};

type ItemOption = {
  id: string;
  sku: string;
  name: string;
  costPrice: number | null;
};

type LineDraft = {
  key: string;
  itemId: string;
  quantity: string;
  unitCost: string;
  notes: string;
};

type InitialPo = {
  id: string;
  poNumber: string;
  supplierId: string;
  warehouseId: string;
  currency: string;
  orderedAt: Date;
  expectedAt: Date | null;
  notes: string | null;
  status: "DRAFT" | "SENT" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED";
  lines: Array<{
    id: string;
    itemId: string;
    orderedQty: number;
    unitCost: string;
    note: string | null;
  }>;
};

export type PurchaseOrderPrefill = {
  supplierId?: string;
  lines?: Array<{ itemId: string; quantity: number }>;
};

type PurchaseOrderFormProps = {
  labels: PurchaseOrderFormLabels;
  mode: "create" | "edit";
  suppliers: SupplierOption[];
  warehouses: WarehouseOption[];
  items: ItemOption[];
  initial?: InitialPo;
  prefill?: PurchaseOrderPrefill;
};

function formatDateInput(date: Date | null | undefined): string {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function blankLine(): LineDraft {
  return {
    key: crypto.randomUUID(),
    itemId: "",
    quantity: "1",
    unitCost: "",
    notes: "",
  };
}

export function PurchaseOrderForm({
  labels,
  mode,
  suppliers,
  warehouses,
  items,
  initial,
  prefill,
}: PurchaseOrderFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const { reset: resetUnsaved, setDirty } = useUnsavedWarning();

  const initialSupplierId = initial?.supplierId ?? prefill?.supplierId ?? suppliers[0]?.id ?? "";
  const initialWarehouseId = initial?.warehouseId ?? warehouses[0]?.id ?? "";

  const [supplierId, setSupplierId] = useState(initialSupplierId);
  const [warehouseId, setWarehouseId] = useState(initialWarehouseId);
  const [currency, setCurrency] = useState(
    initial?.currency ?? suppliers.find((s) => s.id === initialSupplierId)?.currency ?? "USD",
  );
  const [status, setStatus] = useState<InitialPo["status"]>(initial?.status ?? "DRAFT");

  const [lines, setLines] = useState<LineDraft[]>(() => {
    if (initial && initial.lines.length > 0) {
      return initial.lines.map((line) => ({
        key: line.id,
        itemId: line.itemId,
        quantity: String(line.orderedQty),
        unitCost: line.unitCost,
        notes: line.note ?? "",
      }));
    }
    if (!initial && prefill?.lines && prefill.lines.length > 0) {
      return prefill.lines.map((line) => ({
        key: crypto.randomUUID(),
        itemId: line.itemId,
        quantity: String(line.quantity > 0 ? line.quantity : 1),
        unitCost: "",
        notes: "",
      }));
    }
    return [blankLine()];
  });

  const itemsById = useMemo(() => {
    const map = new Map<string, ItemOption>();
    for (const item of items) map.set(item.id, item);
    return map;
  }, [items]);

  function updateLine(key: string, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function addLine() {
    setLines((prev) => [...prev, blankLine()]);
  }

  function removeLine(key: string) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((line) => line.key !== key)));
  }

  const totals = useMemo(() => {
    let subtotal = 0;
    for (const line of lines) {
      const qty = Number(line.quantity) || 0;
      const unit =
        line.unitCost.trim() !== ""
          ? Number(line.unitCost) || 0
          : Number(itemsById.get(line.itemId)?.costPrice ?? 0);
      subtotal += qty * unit;
    }
    return subtotal;
  }, [lines, itemsById]);

  function handleSupplierChange(value: string) {
    setSupplierId(value);
    const supplier = suppliers.find((s) => s.id === value);
    if (supplier) setCurrency(supplier.currency);
    setDirty(true);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    if (!supplierId) {
      setFieldErrors({ supplierId: ["Supplier is required"] });
      return;
    }
    if (!warehouseId) {
      setFieldErrors({ warehouseId: ["Destination warehouse is required"] });
      return;
    }
    const cleanedLines = lines
      .filter((line) => line.itemId !== "")
      .map((line) => ({
        itemId: line.itemId,
        quantity: line.quantity,
        unitCost: line.unitCost === "" ? null : line.unitCost,
        notes: line.notes === "" ? null : line.notes,
      }));
    if (cleanedLines.length === 0) {
      setError(labels.errors.createFailed);
      setFieldErrors({ lines: ["At least one line is required"] });
      return;
    }

    const formData = new FormData(event.currentTarget);
    formData.set("supplierId", supplierId);
    formData.set("warehouseId", warehouseId);
    formData.set("currency", currency);
    formData.set("status", status);
    formData.set("lines", JSON.stringify(cleanedLines));

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createPurchaseOrderAction(formData)
          : await updatePurchaseOrderAction(initial?.id ?? "", formData);

      if (!result.ok) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      resetUnsaved();
      router.push(`/purchase-orders/${result.id}`);
      router.refresh();
    });
  }

  function fieldError(name: string): string | undefined {
    return fieldErrors[name]?.[0];
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="poNumber">
            {labels.fields.poNumber}{" "}
            <span className="text-xs text-muted-foreground">({labels.common.optional})</span>
          </Label>
          <Input
            id="poNumber"
            name="poNumber"
            defaultValue={initial?.poNumber ?? ""}
            aria-invalid={!!fieldError("poNumber")}
            // Phase 18 — autofocus PO number on create
            autoFocus={!initial}
          />
          <p className="text-xs text-muted-foreground">{labels.fields.poNumberHelp}</p>
          {fieldError("poNumber") ? (
            <p className="text-xs text-destructive">{fieldError("poNumber")}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="currency">{labels.fields.currency}</Label>
          <Input
            id="currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            maxLength={3}
          />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label>{labels.fields.supplier}</Label>
          <Select value={supplierId} onValueChange={handleSupplierChange}>
            <SelectTrigger aria-invalid={!!fieldError("supplierId")}>
              <SelectValue placeholder={labels.fields.supplierPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldError("supplierId") ? (
            <p className="text-xs text-destructive">{fieldError("supplierId")}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label>{labels.fields.warehouse}</Label>
          <Select value={warehouseId} onValueChange={setWarehouseId}>
            <SelectTrigger aria-invalid={!!fieldError("warehouseId")}>
              <SelectValue placeholder={labels.fields.warehousePlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {warehouses.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name} <span className="text-muted-foreground">· {w.code}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldError("warehouseId") ? (
            <p className="text-xs text-destructive">{fieldError("warehouseId")}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="orderDate">{labels.fields.orderDate}</Label>
          <Input
            id="orderDate"
            name="orderDate"
            type="date"
            defaultValue={formatDateInput(initial?.orderedAt)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="expectedDate">{labels.fields.expectedDate}</Label>
          <Input
            id="expectedDate"
            name="expectedDate"
            type="date"
            defaultValue={formatDateInput(initial?.expectedAt)}
          />
        </div>
        <div className="space-y-2">
          <Label>{labels.fields.status}</Label>
          <Select value={status} onValueChange={(value) => setStatus(value as InitialPo["status"])}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DRAFT">{labels.statusBadge.DRAFT}</SelectItem>
              <SelectItem value="SENT">{labels.statusBadge.SENT}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-4 rounded-md border p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">{labels.fields.lines}</h2>
          <Button type="button" variant="outline" size="sm" onClick={addLine}>
            <Plus className="h-4 w-4" />
            {labels.fields.addLine}
          </Button>
        </div>
        {lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">{labels.fields.linesEmpty}</p>
        ) : (
          <div className="space-y-3">
            {lines.map((line) => {
              const itemOption = itemsById.get(line.itemId);
              const effectiveUnit =
                line.unitCost.trim() !== ""
                  ? Number(line.unitCost) || 0
                  : Number(itemOption?.costPrice ?? 0);
              const qty = Number(line.quantity) || 0;
              const lineTotal = qty * effectiveUnit;
              return (
                <div
                  key={line.key}
                  className="grid gap-3 rounded-md border bg-muted/20 p-3 md:grid-cols-[2fr_1fr_1fr_1fr_auto]"
                >
                  <div className="space-y-1">
                    <Label className="text-xs">{labels.fields.lineItem}</Label>
                    <Select
                      value={line.itemId}
                      onValueChange={(value) => updateLine(line.key, { itemId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={labels.fields.lineItemPlaceholder} />
                      </SelectTrigger>
                      <SelectContent>
                        {items.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name} <span className="text-muted-foreground">· {item.sku}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{labels.fields.lineQuantity}</Label>
                    <Input
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{labels.fields.lineUnitCost}</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder={itemOption?.costPrice?.toString() ?? "0"}
                      value={line.unitCost}
                      onChange={(e) => updateLine(line.key, { unitCost: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{labels.fields.lineLineTotal}</Label>
                    <div className="flex h-9 items-center rounded-md border bg-background px-3 text-sm">
                      {lineTotal.toFixed(2)}
                    </div>
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeLine(line.key)}
                      disabled={lines.length <= 1}
                      className="text-destructive hover:text-destructive"
                      aria-label={labels.fields.removeLine}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="flex items-center justify-end border-t pt-3 text-sm font-medium">
          <span className="text-muted-foreground">{labels.totalsLabel}:</span>
          <span className="ml-3 font-mono">
            {totals.toFixed(2)} {currency}
          </span>
        </div>
        {fieldError("lines") ? (
          <p className="text-xs text-destructive">{fieldError("lines")}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">
          {labels.fields.notes}{" "}
          <span className="text-xs text-muted-foreground">({labels.common.optional})</span>
        </Label>
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={initial?.notes ?? ""}
          placeholder={labels.fields.notesPlaceholder}
        />
      </div>

      {error ? (
        <div className="rounded-md border border-destructive bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-3 border-t pt-6">
        <Button variant="ghost" asChild>
          <Link href={labels.backHref}>{labels.common.cancel}</Link>
        </Button>
        <Button type="submit" disabled={isPending}>
          {mode === "create" ? labels.common.save : labels.common.saveChanges}
        </Button>
      </div>
    </form>
  );
}
