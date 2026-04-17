"use client";

import { CheckCircle2, Package, ScanLine, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState, useTransition } from "react";

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
import { scanError, scanSuccess } from "@/lib/scanner/feedback";

import { receivePurchaseOrderAction } from "../../actions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReceiveLine = {
  id: string;
  itemName: string;
  itemSku: string;
  /** Phase 11.2: barcode for scan-matching. null when item has no barcode. */
  itemBarcode: string | null;
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
  /** Phase 11.3: label for the putaway CTA. If omitted, no putaway button shown. */
  putawayLabel?: string;
  /** Phase 11.3: href for the putaway CTA. If omitted, no putaway button shown. */
  putawayHref?: string;
  nothingToReceive: string;
  receiveOverflow: string;
  genericError: string;
  // Phase 11.2 — scan input labels
  scanInputLabel: string;
  scanInputPlaceholder: string;
  scanInputHint: string;
  scanMatchFound: string;
  scanMatchNotFound: string;
  scanMatchAlreadyFull: string;
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

// ---------------------------------------------------------------------------
// Barcode matching logic
// ---------------------------------------------------------------------------

/**
 * Find the PO line that matches a scanned code.
 *
 * Match priority:
 *   1. item.barcode (exact)
 *   2. item.sku (exact, case-insensitive)
 *
 * Returns the matching line or null.
 */
export function matchLineByCode(lines: ReceiveLine[], code: string): ReceiveLine | null {
  const trimmed = code.trim();
  if (!trimmed) return null;

  // Priority 1: barcode exact match
  const byBarcode = lines.find((l) => l.itemBarcode !== null && l.itemBarcode === trimmed);
  if (byBarcode) return byBarcode;

  // Priority 2: SKU case-insensitive
  const lower = trimmed.toLowerCase();
  const bySku = lines.find((l) => l.itemSku.toLowerCase() === lower);
  return bySku ?? null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

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

  // Phase 6C — replay protection nonce.
  const [submissionNonce] = useState(() => crypto.randomUUID());

  // Phase 11.2 — scan state
  const [scanValue, setScanValue] = useState("");
  const [scanStatus, setScanStatus] = useState<"idle" | "matched" | "not-found" | "already-full">(
    "idle",
  );
  const [highlightedLineId, setHighlightedLineId] = useState<string | null>(null);

  // Refs to each quantity input so we can focus after a scan match
  const quantityRefs = useRef<Record<string, HTMLInputElement | null>>({});

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

  // ── Quantity helpers ────────────────────────────────────────────────────

  function updateQuantity(lineId: string, value: string) {
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

  // ── Phase 11.2: scan input handler ─────────────────────────────────────

  const handleScan = useCallback(
    (code: string) => {
      const trimmed = code.trim();
      if (!trimmed) return;

      const matched = matchLineByCode(lines, trimmed);

      if (!matched) {
        setScanStatus("not-found");
        setHighlightedLineId(null);
        scanError();
        return;
      }

      const open = openByLine.get(matched.id) ?? 0;
      if (open <= 0) {
        setScanStatus("already-full");
        setHighlightedLineId(matched.id);
        scanError();
        return;
      }

      // Match found — increment quantity by 1, up to the open amount
      setQuantities((prev) => {
        const current = Number(prev[matched.id] ?? "0") || 0;
        const next = Math.min(current + 1, open);
        return { ...prev, [matched.id]: String(next) };
      });

      setScanStatus("matched");
      setHighlightedLineId(matched.id);
      scanSuccess();

      // Focus the quantity input for the matched line
      // so the operator can manually adjust if needed
      const ref = quantityRefs.current[matched.id];
      if (ref) {
        ref.focus();
        ref.select();
      }
    },
    [lines, openByLine],
  );

  function handleScanSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    handleScan(scanValue);
    setScanValue("");
  }

  // ── Main form submit ────────────────────────────────────────────────────

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

  // ── Success screen ──────────────────────────────────────────────────────

  if (success) {
    return (
      <div className="rounded-md border border-success bg-success-light p-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-success" />
          <div className="flex-1 space-y-2">
            <h2 className="text-base font-semibold text-success">{labels.successTitle}</h2>
            <p className="text-sm text-success/80">
              {labels.successBody(success.receivedLineCount)}
            </p>
            {success.fullyReceived ? (
              <p className="text-sm text-success/80">{labels.successFullyReceived}</p>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button variant="outline" asChild>
                <a href={backHref}>{labels.viewPo}</a>
              </Button>
              {/* Phase 11.3: putaway CTA — only shown when warehouse has bins */}
              {labels.putawayHref && labels.putawayLabel ? (
                <Button asChild>
                  <a href={labels.putawayHref}>{labels.putawayLabel}</a>
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Receive form ────────────────────────────────────────────────────────

  // Phase 12.5 — compute receipt progress stats.
  const totalOrdered = lines.reduce((sum, l) => sum + l.orderedQty, 0);
  const totalPreviouslyReceived = lines.reduce((sum, l) => sum + l.receivedQty, 0);
  const totalInCurrentForm = Object.values(quantities).reduce(
    (sum, v) => sum + (Number.parseInt(v || "0", 10) || 0),
    0,
  );
  const pctReceived =
    totalOrdered > 0
      ? Math.min(
          100,
          Math.round(((totalPreviouslyReceived + totalInCurrentForm) / totalOrdered) * 100),
        )
      : 0;

  return (
    <div className="space-y-4">
      {/* Phase 12.5 — receipt progress bar */}
      {totalOrdered > 0 ? (
        <div className="space-y-1.5 rounded-md border bg-muted/20 p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Receiving progress</span>
            <span className="tabular-nums text-muted-foreground">
              {totalPreviouslyReceived + totalInCurrentForm} / {totalOrdered} units — {pctReceived}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all ${pctReceived === 100 ? "bg-success" : "bg-primary"}`}
              style={{ width: `${pctReceived}%` }}
            />
          </div>
        </div>
      ) : null}

      {/* ── Phase 11.2: Scan input panel ─────────────────────────── */}
      <div className="rounded-md border bg-muted/30 p-3 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <ScanLine className="h-4 w-4 text-muted-foreground" />
          {labels.scanInputLabel}
        </div>
        <form onSubmit={handleScanSubmit} className="flex gap-2">
          <Input
            type="text"
            value={scanValue}
            onChange={(e) => {
              setScanValue(e.target.value);
              setScanStatus("idle");
              setHighlightedLineId(null);
            }}
            placeholder={labels.scanInputPlaceholder}
            autoComplete="off"
            autoFocus
            className="font-mono"
            aria-label={labels.scanInputLabel}
          />
          <Button
            type="submit"
            variant="secondary"
            disabled={!scanValue.trim()}
            className="shrink-0"
          >
            <ScanLine className="h-4 w-4" />
          </Button>
        </form>
        <p className="text-xs text-muted-foreground">{labels.scanInputHint}</p>
        {scanStatus === "not-found" ? (
          <div className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
            <TriangleAlert className="h-3.5 w-3.5" />
            {labels.scanMatchNotFound}
          </div>
        ) : null}
        {scanStatus === "already-full" ? (
          <div className="flex items-center gap-1.5 text-xs text-warning" role="alert">
            <TriangleAlert className="h-3.5 w-3.5" />
            {labels.scanMatchAlreadyFull}
          </div>
        ) : null}
        {scanStatus === "matched" ? (
          <div className="flex items-center gap-1.5 text-xs text-success">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {labels.scanMatchFound}
          </div>
        ) : null}
      </div>

      {/* ── Receive table + submit ────────────────────────────────── */}
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
                const isHighlighted = line.id === highlightedLineId;
                return (
                  <TableRow
                    key={line.id}
                    className={isHighlighted ? "bg-success-light transition-colors" : undefined}
                  >
                    <TableCell className="font-medium">{line.itemName}</TableCell>
                    <TableCell className="font-mono text-xs">{line.itemSku}</TableCell>
                    <TableCell className="text-right font-mono">{line.orderedQty}</TableCell>
                    <TableCell className="text-right font-mono">{line.receivedQty}</TableCell>
                    <TableCell className="text-right font-mono">{open}</TableCell>
                    <TableCell className="text-right">
                      <Input
                        ref={(el) => {
                          quantityRefs.current[line.id] = el;
                        }}
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
    </div>
  );
}
