"use client";

import { CloudOff, Loader2 } from "lucide-react";
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
