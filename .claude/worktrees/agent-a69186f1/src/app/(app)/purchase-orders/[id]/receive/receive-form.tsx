"use client";

import { CheckCircle2, Package } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

import { receivePurchaseOrderAction } from "../../actions";

export type ReceiveLine = {
  id: string;
  itemName: string;
  itemSku: string;
  orderedQty: number;
  receivedQty: number;
};

export type ReceiveFormLabels = {
  columnItem: string;
  columnSku: string;
  columnOrdered: string;
  columnReceived: string;
  columnOpen: string;
  columnReceiveNow: string;
  notesLabel: string;
  notesPlaceholder: string;
  submit: string;
  submitAll: string;
  cancel: string;
  successTitle: string;
  successBody: (count: number) => string;
  successFullyReceived: string;
  viewPo: string;
  nothingToReceive: string;
  receiveOverflow: string;
  genericError: string;
};

type ReceiveFormProps = {
  purchaseOrderId: string;
  poNumber: string;
  backHref: string;
  lines: ReceiveLine[];
  labels: ReceiveFormLabels;
};

type SuccessState = {
  receivedLineCount: number;
  fullyReceived: boolean;
};

export function ReceiveForm({
  purchaseOrderId,
  poNumber,
  backHref,
  lines,
  labels,
}: ReceiveFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [notes, setNotes] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const line of lines) initial[line.id] = "";
    return initial;
  });
  // Phase 6C — replay protection nonce. Minted once per form mount
  // and resubmitted on every retry, so the server action can derive
  // the same per-line idempotency keys on a replay and short-circuit
  // the transaction. A fresh navigation to this page mints a new
  // nonce (correct — a new human decision is a new receive). Two
  // tabs open on the same PO will mint DIFFERENT nonces and can
  // still over-receive; that is the existing multi-writer
  // concurrency bug tracked at `actions.ts:482-489` and is
  // explicitly out of Phase 6C scope.
  const [submissionNonce] = useState(() => crypto.randomUUID());

  const openByLine = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of lines) {
      map.set(line.id, Math.max(0, line.orderedQty - line.receivedQty));
    }
    return map;
  }, [lines]);

  const hasAnyOpen = useMemo(
    () => Array.from(openByLine.values()).some((v) => v > 0),
    [openByLine],
  );

  function updateQuantity(lineId: string, value: string) {
    // Allow only digits and empty
    if (value !== "" && !/^\d+$/.test(value)) return;
    setQuantities((prev) => ({ ...prev, [lineId]: value }));
  }

  function handleReceiveAll() {
    const next: Record<string, string> = {};
    for (const line of lines) {
      const open = Math.max(0, line.orderedQty - line.receivedQty);
      next[line.id] = open > 0 ? String(open) : "";
    }
    setQuantities(next);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const receipts = lines
      .map((line) => {
        const raw = quantities[line.id] ?? "";
        const qty = raw === "" ? 0 : Number(raw);
        return { lineId: line.id, quantity: qty };
      })
      .filter((r) => r.quantity > 0);

    if (receipts.length === 0) {
      setError(labels.nothingToReceive);
      return;
    }

    // Client-side overflow guard — server re-checks too.
    for (const r of receipts) {
      const open = openByLine.get(r.lineId) ?? 0;
      if (r.quantity > open) {
        setError(labels.receiveOverflow);
        return;
      }
    }

    const formData = new FormData();
    formData.set("purchaseOrderId", purchaseOrderId);
    formData.set("receipts", JSON.stringify(receipts));
    formData.set("notes", notes);
    formData.set("submissionNonce", submissionNonce);

    startTransition(async () => {
      const result = await receivePurchaseOrderAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess({
        receivedLineCount: result.receivedLineCount,
        fullyReceived: result.fullyReceived,
      });
      router.refresh();
    });
  }

  if (success) {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-900/50 dark:bg-emerald-950/40">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <div className="flex-1 space-y-2">
            <h2 className="text-base font-semibold text-emerald-900 dark:text-emerald-100">
              {labels.successTitle}
            </h2>
            <p className="text-sm text-emerald-900/80 dark:text-emerald-100/80">
              {labels.successBody(success.receivedLineCount)}
            </p>
            {success.fullyReceived ? (
              <p className="text-sm text-emerald-900/80 dark:text-emerald-100/80">
                {labels.successFullyReceived}
              </p>
            ) : null}
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{labels.columnItem}</TableHead>
              <TableHead>{labels.columnSku}</TableHead>
              <TableHead className="text-right">{labels.columnOrdered}</TableHead>
              <TableHead className="text-right">{labels.columnReceived}</TableHead>
              <TableHead className="text-right">{labels.columnOpen}</TableHead>
              <TableHead className="w-[140px] text-right">{labels.columnReceiveNow}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line) => {
              const open = openByLine.get(line.id) ?? 0;
              const isClosed = open <= 0;
              return (
                <TableRow key={line.id}>
                  <TableCell className="font-medium">{line.itemName}</TableCell>
                  <TableCell className="font-mono text-xs">{line.itemSku}</TableCell>
                  <TableCell className="text-right font-mono">{line.orderedQty}</TableCell>
                  <TableCell className="text-right font-mono">{line.receivedQty}</TableCell>
                  <TableCell className="text-right font-mono">{open}</TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={quantities[line.id] ?? ""}
                      onChange={(e) => updateQuantity(line.id, e.target.value)}
                      disabled={isClosed || isPending}
                      placeholder={isClosed ? "—" : "0"}
                      className="text-right font-mono"
                      aria-label={`${labels.columnReceiveNow} — ${line.itemName}`}
                    />
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
          onClick={handleReceiveAll}
          disabled={!hasAnyOpen || isPending}
        >
          <Package className="h-4 w-4" />
          {labels.submitAll}
        </Button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="receive-notes">{labels.notesLabel}</Label>
        <Textarea
          id="receive-notes"
          name="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={labels.notesPlaceholder}
          rows={3}
          disabled={isPending}
        />
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
        <Button type="submit" disabled={isPending || !hasAnyOpen}>
          {labels.submit} {poNumber ? `· ${poNumber}` : ""}
        </Button>
      </div>
    </form>
  );
}
