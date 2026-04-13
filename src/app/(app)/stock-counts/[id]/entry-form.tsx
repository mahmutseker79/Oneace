"use client";

import { CloudOff, Loader2 } from "lucide-react";
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
import { COUNT_ENTRY_ADD_OP_TYPE } from "@/lib/offline/dispatchers/count-entry-add";
import { enqueueOp } from "@/lib/offline/queue";
import type { AddEntryInput } from "@/lib/validation/stockcount";

import { submitCountEntryOpAction } from "../actions";

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
  submittingLabel: string;
  queuedLabel: string;
  error: string;
};

export type EntryFormScope = {
  orgId: string;
  userId: string;
};

type EntryFormProps = {
  countId: string;
  scope: EntryFormScope;
  rows: ScopeOption[];
  labels: EntryFormLabels;
};

/**
 * Sprint 27 — PWA Sprint 4 follow-on. The stock-count entry form is
 * now offline-first. Behavior mirrors the Sprint 26 movement form:
 *
 *   1. Generate a v4 UUID (`crypto.randomUUID()`) as the idempotency
 *      key BEFORE any network attempt. If we fall back to the queue,
 *      the same key rides along so a replay can't double-count.
 *
 *   2. Try `submitCountEntryOpAction` directly. Online fast path:
 *      the counter sees the row appear in the log, page refreshes,
 *      nothing touches IndexedDB.
 *
 *   3. On transport failure (`navigator.onLine === false`, fetch
 *      throws, or the action returns `retryable: true`), enqueue
 *      the op under the `countEntry.add` opType and reset the form
 *      so the counter can move to the next bin immediately.
 *
 *   4. On a non-retryable error (validation, count not found,
 *      out-of-scope row), surface the message inline and do NOT
 *      enqueue — a broken payload would loop forever.
 *
 * The cascade UX is unchanged from Sprint 3: item select filters the
 * warehouse select to (item, warehouse) pairs that are in this
 * count's snapshot. A counter scanning a bin picks the SKU first,
 * then the warehouse narrows to "here's where this SKU is expected".
 *
 * After a successful or queued save, qty + note reset but the
 * selected item stays so the same SKU can be hammered across
 * multiple bin locations without clicking the dropdown again.
 */
export function EntryForm({ countId, scope, rows, labels }: EntryFormProps) {
  const router = useRouter();
  const [itemId, setItemId] = useState<string>("");
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [countedQuantity, setCountedQuantity] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const itemOptions = Array.from(new Map(rows.map((row) => [row.itemId, row.itemLabel])).entries());
  const warehouseOptions = rows.filter((row) => row.itemId === itemId);

  /**
   * Client-side feature check for `crypto.randomUUID`. All modern
   * browsers on secure contexts support it; the fallback is only
   * ever hit in odd test environments. The queue's idempotency
   * guarantee depends on the key being globally unique.
   */
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

  function resetAfterSave() {
    setCountedQuantity("");
    setNote("");
    // Keep itemId so the counter can hammer the same SKU across bins.
  }

  async function enqueueAndReset(idempotencyKey: string, input: AddEntryInput): Promise<void> {
    const enqueued = await enqueueOp({
      scope: { orgId: scope.orgId, userId: scope.userId },
      opType: COUNT_ENTRY_ADD_OP_TYPE,
      payload: { idempotencyKey, input },
    });
    if (!enqueued) {
      // Dexie unavailable — surface the original error so the user
      // isn't told "queued" when nothing actually persisted.
      setError(labels.error);
      return;
    }
    resetAfterSave();
    router.refresh();
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (itemId === "" || warehouseId === "" || countedQuantity === "") {
      setError(labels.error);
      return;
    }

    const quantity = Number(countedQuantity);
    if (!Number.isFinite(quantity) || quantity < 0) {
      setError(labels.error);
      return;
    }

    const input: AddEntryInput = {
      countId,
      itemId,
      warehouseId,
      binId: null,
      countedQuantity: Math.trunc(quantity),
      counterTag: null,
      note: note.trim() === "" ? null : note.trim(),
    };

    const idempotencyKey = generateIdempotencyKey();
    const payload = { idempotencyKey, input };

    startTransition(async () => {
      const startsOffline = typeof navigator !== "undefined" && navigator.onLine === false;

      if (!startsOffline) {
        try {
          const result = await submitCountEntryOpAction(payload);
          if (result.ok) {
            resetAfterSave();
            router.refresh();
            return;
          }
          if (!result.retryable) {
            setError(result.error);
            return;
          }
          // Retryable failure (transient DB, constraint race). Fall
          // through to the enqueue path so the entry isn't lost.
        } catch {
          // Transport-layer throw — fetch failed, SW served the
          // offline fallback, CORS weirdness. Fall through to enqueue
          // so the counter doesn't lose the scan.
        }
      }

      await enqueueAndReset(idempotencyKey, input);
    });
  }

  const isOfflineNow = typeof navigator !== "undefined" && navigator.onLine === false;

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
          {isPending ? (
            <>
              {isOfflineNow ? (
                <CloudOff className="h-4 w-4" />
              ) : (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              <span>{labels.submittingLabel}</span>
            </>
          ) : isOfflineNow ? (
            <>
              <CloudOff className="h-4 w-4" />
              <span>{labels.queuedLabel}</span>
            </>
          ) : (
            labels.submit
          )}
        </Button>
      </div>
    </form>
  );
}
