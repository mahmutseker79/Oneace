"use client";

// Phase 2 UX — the item selector is now a Combobox with type-ahead
// search. With 100+ items a plain Select requires too much scrolling.
// Warehouse selectors keep the standard Select (typically ≤10 options).

import { Check, ChevronsUpDown, CloudOff, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

// ---------------------------------------------------------------------------
// ItemCombobox — Popover-based type-ahead selector for item picking.
// Keeps the Select API signature so the parent form is unchanged.
// ---------------------------------------------------------------------------

function ItemCombobox({
  items,
  value,
  onValueChange,
  placeholder,
}: {
  items: Array<{ id: string; label: string; sub?: string }>;
  value: string;
  onValueChange: (v: string) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return items;
    return items.filter(
      (i) => i.label.toLowerCase().includes(q) || (i.sub ?? "").toLowerCase().includes(q),
    );
  }, [items, query]);

  const selected = items.find((i) => i.id === value);

  function handleSelect(id: string) {
    onValueChange(id);
    setQuery("");
    setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) {
          // Focus the search input when popover opens.
          window.setTimeout(() => inputRef.current?.focus(), 0);
        } else {
          setQuery("");
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-haspopup="listbox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className="truncate text-left">{selected ? selected.label : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="border-b p-2">
          <Input
            ref={inputRef}
            placeholder="Search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 border-0 p-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="max-h-56 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">No items found.</p>
          ) : (
            filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
              >
                <Check
                  className={`h-3.5 w-3.5 shrink-0 ${value === item.id ? "opacity-100" : "opacity-0"}`}
                />
                <span className="truncate">{item.label}</span>
                {item.sub ? (
                  <span className="ml-auto shrink-0 font-mono text-xs text-muted-foreground">
                    {item.sub}
                  </span>
                ) : null}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
import { MOVEMENT_CREATE_OP_TYPE } from "@/lib/offline/dispatchers/movement-create";
import { enqueueOp } from "@/lib/offline/queue";
import type { MovementInput } from "@/lib/validation/movement";

import { submitMovementOpAction } from "./actions";

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
  submittingLabel: string;
  queuedLabel: string;
  error: string;
  cancel: string;
};

export type MovementFormOption = { id: string; label: string; sub?: string };

export type MovementFormScope = {
  orgId: string;
  userId: string;
};

/**
 * P9.2 architectural boundary: BIN_TRANSFER is intentionally excluded
 * from this generic movement form. Bin-to-bin transfers live on the
 * warehouse bins page (`/warehouses/[id]/bins`) where the user already
 * has warehouse + bin context. The backend schema and validation layer
 * accept BIN_TRANSFER, but the UI entry point is scoped to the bins
 * page only. This avoids adding a complex cascading bin selector to
 * the generic form that most users don't need.
 *
 * @see src/app/(app)/warehouses/[id]/bins/bin-transfer-dialog.tsx
 * @see src/app/(app)/warehouses/[id]/bins/bin-transfer-action.ts
 */
type MovementType = "RECEIPT" | "ISSUE" | "ADJUSTMENT" | "TRANSFER";

type MovementFormProps = {
  labels: MovementFormLabels;
  scope: MovementFormScope;
  items: MovementFormOption[];
  warehouses: MovementFormOption[];
  presetItemId?: string;
  presetWarehouseId?: string;
};

/**
 * Sprint 26 — PWA Sprint 4 Part B. The form now always goes through
 * the idempotent JSON path:
 *
 *   1. Generate a v4 UUID (`crypto.randomUUID()`) as the idempotency
 *      key BEFORE any network attempt. If anything from here to
 *      "server accepted" fails and we fall back to the queue, the
 *      same key is stored on the pending op so a replay can't
 *      double-apply.
 *
 *   2. Try `submitMovementOpAction` directly. This is the online
 *      fast path: the user sees the save, the list revalidates, and
 *      nothing touches IndexedDB. On success we navigate.
 *
 *   3. On transport failure (fetch throws, `navigator.onLine` is
 *      false before we even try, or the action returns a
 *      `retryable: true` error), enqueue the op to Dexie and let
 *      the Sprint 25 runner pick it up. The form shows a
 *      queued-state toast and navigates back to the list.
 *
 *   4. On a non-retryable error (validation, missing item/warehouse,
 *      unauthenticated), surface the message inline. Do NOT enqueue
 *      — a broken payload would just loop in the queue forever.
 */
export function MovementForm({
  labels,
  scope,
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();

  const destinationOptions = useMemo(
    () => warehouses.filter((w) => w.id !== warehouseId),
    [warehouses, warehouseId],
  );

  function buildInput(form: HTMLFormElement): MovementInput | null {
    const formData = new FormData(form);
    const quantityRaw = formData.get("quantity");
    const quantity = Number(quantityRaw);
    if (!Number.isFinite(quantity) || quantity < 1) return null;
    const reference = ((formData.get("reference") as string | null) ?? "").trim() || null;
    const note = ((formData.get("note") as string | null) ?? "").trim() || null;

    const base = {
      itemId,
      warehouseId,
      quantity: Math.trunc(quantity),
      reference,
      note,
    };

    if (type === "TRANSFER") {
      return { type: "TRANSFER", ...base, toWarehouseId };
    }
    if (type === "ADJUSTMENT") {
      return { type: "ADJUSTMENT", ...base, direction: direction === "-1" ? -1 : 1 };
    }
    // RECEIPT | ISSUE
    return { type, ...base };
  }

  /**
   * Client-side feature check for `crypto.randomUUID`. All modern
   * browsers on secure contexts support it; the fallback is only
   * ever hit in odd test environments. The queue's idempotency
   * guarantee depends on the key being globally unique, so the
   * fallback uses `Math.random()` across 36 chars — not
   * cryptographically random but unique enough for a per-tab op.
   */
  function generateIdempotencyKey(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    // RFC 4122 v4 shape via Math.random fallback
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  async function enqueueAndNavigate(idempotencyKey: string, input: MovementInput): Promise<void> {
    const enqueued = await enqueueOp({
      scope: { orgId: scope.orgId, userId: scope.userId },
      opType: MOVEMENT_CREATE_OP_TYPE,
      payload: { idempotencyKey, input },
    });
    if (!enqueued) {
      // Dexie unavailable — surface the original error so the user
      // isn't told "queued" when nothing actually persisted.
      setError(labels.error);
      return;
    }
    router.push("/movements");
    router.refresh();
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    const form = event.currentTarget;
    const input = buildInput(form);
    if (!input) {
      // The native `required` / `min={1}` attributes should cover
      // this, but guard anyway so a future DOM refactor doesn't
      // silently ship broken payloads.
      setError(labels.error);
      return;
    }

    const idempotencyKey = generateIdempotencyKey();
    const payload = { idempotencyKey, input };

    startTransition(async () => {
      // Pre-flight: if the browser already believes it's offline,
      // skip the direct RPC and go straight to the queue. Saves a
      // fetch attempt that will fail and also preserves deterministic
      // behavior when the user is explicitly offline.
      const startsOffline = typeof navigator !== "undefined" && navigator.onLine === false;

      if (!startsOffline) {
        try {
          const result = await submitMovementOpAction(payload);
          if (result.ok) {
            router.push("/movements");
            router.refresh();
            return;
          }
          if (!result.retryable) {
            setError(result.error);
            if (result.fieldErrors) setFieldErrors(result.fieldErrors);
            return;
          }
          // Retryable failure from the server (transient DB error
          // etc.). Fall through to the enqueue path.
        } catch {
          // Transport-layer throw — fetch failed, the SW returned
          // the offline fallback, CORS weirdness. Fall through to
          // enqueue so the user doesn't lose their input.
        }
      }

      await enqueueAndNavigate(idempotencyKey, input);
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

      {/* Item — Combobox with type-ahead search (Phase 2 UX) */}
      <div className="space-y-2">
        <Label>{labels.item}</Label>
        <ItemCombobox
          items={items}
          value={itemId}
          onValueChange={setItemId}
          placeholder={labels.itemPlaceholder}
        />
        {fieldErrors.itemId ? (
          <p className="text-xs text-destructive">{fieldErrors.itemId[0]}</p>
        ) : null}
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
        {fieldErrors.warehouseId ? (
          <p className="text-xs text-destructive">{fieldErrors.warehouseId[0]}</p>
        ) : null}
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
          {fieldErrors.toWarehouseId ? (
            <p className="text-xs text-destructive">{fieldErrors.toWarehouseId[0]}</p>
          ) : null}
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
          {isPending ? (
            <>
              {typeof navigator !== "undefined" && navigator.onLine === false ? (
                <CloudOff className="h-4 w-4" />
              ) : (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              <span>{labels.submittingLabel}</span>
            </>
          ) : (
            labels.submit
          )}
        </Button>
      </div>
    </form>
  );
}
