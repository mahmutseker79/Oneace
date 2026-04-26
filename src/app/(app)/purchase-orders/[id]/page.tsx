// Sprint 38: enriched purchase-order detail page.
//
// The Sprint 5 version of this page covered the bare minimum
// (line table + status meta + action buttons). After shipping
// Sprint 36's audit log and Sprint 34's supplier drill-down, a
// PO detail page that doesn't surface receipts or audit history
// looked visibly thinner than the rest of the app — and warehouse
// OWNERs investigating "why is this PO still partially received?"
// were forced to cross-reference three different screens.
//
// This sprint enriches the page with four additions, all read-only
// (no schema changes, no new mutations):
//
//   1. **KPI strip** — five cards at the top: status, % received,
//      total value, line count, days-open. The values are computed
//      from the already-loaded PO row, so no extra queries.
//
//   2. **Supplier link + creator chip** — turns the supplier name
//      into a link to `/suppliers/[id]` (the Sprint 34 drill-down)
//      and shows who created the PO and when.
//
//   3. **Receipts history card** — lists every `StockMovement`
//      with `type: RECEIPT` and `reference: po.poNumber`. That's
//      the same link the receive action writes; we don't have a
//      foreign key from movement to PO by design (the ledger
//      stays PO-agnostic), so `reference` is the durable join.
//      Rows show timestamp, actor, warehouse, and the set of
//      (item, qty) pairs from the same receive event, grouped by
//      createdAt second so a multi-line receive looks like one
//      transaction.
//
//   4. **Audit trail card** — the Sprint 36 audit log filtered to
//      rows for this specific PO. Uses the same `renderMetadata`
//      treatment as `/audit/page.tsx` so the inline formatting
//      stays consistent. Admin gating happens at the /audit route;
//      here we show the rows to anyone who can read the PO itself
//      (MANAGER upwards — enforced by the existing server-action
//      layer) because the audit trail for a single PO is part of
//      its canonical record, not a governance surface.
//
// All four queries are parallelised via `Promise.all` so the
// added sections don't add serial latency to the render.

import { ClipboardList, Package } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AuditAction } from "@/lib/audit";
import { db } from "@/lib/db";
import { getMessages, getRegion } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";
import { formatCurrency } from "@/lib/utils";

import { CopyButton } from "@/components/ui/copy-button";
import { PageHeader } from "@/components/ui/page-header";
import { StatusTimeline } from "@/components/ui/status-timeline";

import { CancelPoButton } from "./cancel-po-button";
import { MarkSentButton } from "./mark-sent-button";

type DetailPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: DetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const t = await getMessages();
  const po = await db.purchaseOrder.findUnique({
    where: { id },
    select: { poNumber: true },
  });
  return {
    title: po
      ? `${po.poNumber} — ${t.purchaseOrders.detail.metaTitle}`
      : t.purchaseOrders.detail.metaTitle,
  };
}

function fmtDate(value: Date | null | undefined, locale: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(value);
}

function fmtDateTime(value: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

// Same terse renderer the /audit page uses — nested objects become
// just their key set so the reviewer can spot anomalies without a
// wall of JSON. Kept inline (rather than in a shared util) because
// the /audit and PO-audit-card variants are only two call sites
// and a premature shared helper is harder to find than two copies.
function renderAuditMetadata(raw: unknown): string {
  if (raw == null) return "";
  if (typeof raw !== "object") return String(raw);
  const parts: string[] = [];
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value == null) continue;
    if (typeof value === "object") {
      parts.push(`${key}: {${Object.keys(value as object).join(", ")}}`);
    } else {
      parts.push(`${key}: ${String(value)}`);
    }
  }
  return parts.join(" · ");
}

function auditLabel(action: string, catalog: Record<AuditAction, string>): string {
  return (catalog as Record<string, string | undefined>)[action] ?? action;
}

// Round a date down to the nearest second so a multi-line receive
// (five lines posted inside the same transaction, all stamped with
// the same `createdAt` to the nearest ms) collapses into a single
// "receipt event" row in the history card. The precise timestamp
// is kept for the header so sub-second clock drift isn't hidden.
function secondBucket(d: Date): number {
  return Math.floor(d.getTime() / 1000);
}

export default async function PurchaseOrderDetailPage({ params }: DetailPageProps) {
  const { id } = await params;
  const { membership } = await requireActiveMembership();
  const t = await getMessages();
  const region = await getRegion();

  const po = await db.purchaseOrder.findFirst({
    where: { id, organizationId: membership.organizationId },
    include: {
      supplier: { select: { id: true, name: true, code: true } },
      warehouse: { select: { id: true, name: true, code: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      lines: {
        orderBy: { createdAt: "asc" },
        include: {
          item: { select: { id: true, sku: true, name: true } },
        },
      },
    },
  });

  if (!po) notFound();

  // Sprint 38: run the two new read queries in parallel. Both are
  // cheap (composite-indexed lookups) but serialising them would
  // add a needless round-trip to the render path.
  const [receiptMovements, auditRows] = await Promise.all([
    db.stockMovement.findMany({
      where: {
        organizationId: membership.organizationId,
        type: "RECEIPT",
        reference: po.poNumber,
      },
      include: {
        item: { select: { id: true, sku: true, name: true } },
        warehouse: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      // 200 receipt rows covers every realistic PO (the largest
      // we've seen in the Flutter predecessor had ~60 lines
      // received across ~5 events). A hard cap keeps the page
      // render bounded if someone imports a pathological PO.
      take: 200,
    }),
    db.auditEvent.findMany({
      where: {
        organizationId: membership.organizationId,
        entityType: "purchase_order",
        // We match on entityId first (the normal path) but also
        // include rows where entityId is null — the delete audit
        // writes null because the row it refers to is gone, and
        // carries the poNumber in metadata. Those can't be
        // filtered server-side without a JSON query, so we pull
        // the broader set and filter in memory below.
        OR: [{ entityId: po.id }, { entityId: null }],
      },
      include: {
        actor: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 100,
    }),
  ]);

  // Filter out audit rows that came in via the "entityId: null"
  // branch but belong to a different PO (i.e. their metadata
  // poNumber doesn't match). This keeps the card accurate without
  // paying for a JSON-where query.
  const scopedAudit = auditRows.filter((row) => {
    if (row.entityId === po.id) return true;
    if (row.entityId !== null) return false;
    const meta = row.metadata;
    if (!meta || typeof meta !== "object") return false;
    return (meta as Record<string, unknown>).poNumber === po.poNumber;
  });

  // Group receipt movements by the receive event (same second).
  // The map preserves insertion order (Map iteration is defined
  // by ES2015 to be insertion order) which matches our orderBy
  // createdAt desc — so the grouped events render newest-first.
  type ReceiptEvent = {
    at: Date;
    actorLabel: string;
    warehouseName: string;
    warehouseCode: string;
    note: string | null;
    lines: { item: { id: string; sku: string; name: string }; qty: number }[];
  };
  const receiptEvents = new Map<number, ReceiptEvent>();
  for (const mv of receiptMovements) {
    const bucket = secondBucket(mv.createdAt);
    const actorLabel = mv.createdBy
      ? (mv.createdBy.name ?? mv.createdBy.email)
      : t.purchaseOrders.detail.receiptSystemActor;
    const existing = receiptEvents.get(bucket);
    if (existing) {
      existing.lines.push({ item: mv.item, qty: mv.quantity });
      // Carry over the first non-empty note — multi-line receives
      // share one note so there's nothing to merge.
      if (!existing.note && mv.note) existing.note = mv.note;
    } else {
      receiptEvents.set(bucket, {
        at: mv.createdAt,
        actorLabel,
        warehouseName: mv.warehouse.name,
        warehouseCode: mv.warehouse.code,
        note: mv.note,
        lines: [{ item: mv.item, qty: mv.quantity }],
      });
    }
  }

  // --- KPI strip math ------------------------------------------------
  // All values derive from the already-loaded PO row, so zero
  // extra queries. `totalOrdered` and `totalReceived` are summed
  // with plain JS because the line count per PO is bounded and we
  // already have the lines in memory for the line-table render.
  let total = 0;
  let orderedUnits = 0;
  let receivedUnits = 0;
  for (const line of po.lines) {
    total += line.orderedQty * Number(line.unitCost);
    orderedUnits += line.orderedQty;
    receivedUnits += line.receivedQty;
  }
  const percentReceived = orderedUnits > 0 ? Math.round((receivedUnits / orderedUnits) * 100) : 0;

  // Days-open is wall-clock from `orderedAt` to either the
  // received-at stamp (terminal success) or today. For DRAFT rows
  // where `orderedAt` is null we fall back to `createdAt`.
  const startDate = po.orderedAt ?? po.createdAt;
  const endDate = po.receivedAt ?? new Date();
  const daysOpen = Math.max(
    0,
    Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
  );

  const canEdit = po.status === "DRAFT" || po.status === "SENT";
  const canReceive =
    po.status === "DRAFT" || po.status === "SENT" || po.status === "PARTIALLY_RECEIVED";
  const canMarkSent = po.status === "DRAFT";
  const canCancel =
    po.status === "DRAFT" || po.status === "SENT" || po.status === "PARTIALLY_RECEIVED";
  // Phase 11.3: putaway is available when any stock has been received.
  const canPutaway = receivedUnits > 0;

  return (
    <div className="space-y-6">
      {/* God-Mode Design: Breadcrumb navigation */}
      <PageHeader
        title={po.poNumber}
        backHref="/purchase-orders"
        breadcrumb={[
          { label: t.purchaseOrders?.heading ?? "Purchase Orders", href: "/purchase-orders" },
          { label: po.poNumber },
        ]}
      />
      <StatusTimeline
        steps={[
          { label: "Draft", completed: po.status !== "DRAFT", active: po.status === "DRAFT" },
          {
            label: "Sent",
            completed: ["PARTIALLY_RECEIVED", "RECEIVED"].includes(po.status),
            active: po.status === "SENT",
          },
          {
            label: "Partial",
            completed: po.status === "RECEIVED",
            active: po.status === "PARTIALLY_RECEIVED",
          },
          { label: "Received", completed: po.status === "RECEIVED", active: false },
        ]}
        className="mb-2"
      />
      <div className="space-y-1">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="font-mono text-2xl font-semibold">{po.poNumber}</h1>
              {/* Phase 16.2 — copy PO number to clipboard */}
              <CopyButton text={po.poNumber} label="Copy PO number" />
            </div>
            <p className="text-muted-foreground">
              <Link href={`/suppliers/${po.supplier.id}`} className="hover:underline">
                {po.supplier.name}
              </Link>
              {po.supplier.code ? (
                <span className="text-xs font-mono"> · {po.supplier.code}</span>
              ) : null}
            </p>
            {po.createdBy ? (
              <p className="text-xs text-muted-foreground">
                {t.purchaseOrders.detail.metaCreatedBy}: {po.createdBy.name ?? po.createdBy.email} ·{" "}
                {fmtDateTime(po.createdAt, region.numberLocale)}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {canMarkSent ? (
              <MarkSentButton id={po.id} label={t.purchaseOrders.detail.sendAction} />
            ) : null}
            {canEdit ? (
              <Button variant="outline" asChild>
                <Link href={`/purchase-orders/${po.id}/edit`}>
                  {t.purchaseOrders.detail.editAction}
                </Link>
              </Button>
            ) : null}
            {canReceive ? (
              <Button asChild>
                <Link href={`/purchase-orders/${po.id}/receive`}>
                  <Package className="h-4 w-4" />
                  {t.purchaseOrders.detail.receiveAction}
                </Link>
              </Button>
            ) : null}
            {/* Phase 11.3: putaway CTA */}
            {canPutaway ? (
              <Button variant="outline" asChild>
                <Link href={`/purchase-orders/${po.id}/putaway`}>
                  {t.purchaseOrders.putaway.heading}
                </Link>
              </Button>
            ) : null}
            {canCancel ? (
              <CancelPoButton
                id={po.id}
                labels={{
                  trigger: t.purchaseOrders.detail.cancelAction,
                  title: t.purchaseOrders.detail.cancelConfirmTitle,
                  description: t.purchaseOrders.detail.cancelConfirmBody,
                  confirm: t.purchaseOrders.detail.cancelConfirmCta,
                  cancel: t.common.cancel,
                }}
              />
            ) : null}
          </div>
        </div>
      </div>

      {/* Sprint 38: five-up KPI strip. */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {t.purchaseOrders.detail.metaStatus}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Phase 6.1 — RECEIVED = emerald (matches list page fix from Phase 3.7) */}
            {po.status === "RECEIVED" ? (
              <Badge className="bg-success text-success-foreground hover:bg-success/90">
                {t.purchaseOrders.statusBadge[po.status]}
              </Badge>
            ) : (
              <Badge variant={po.status === "CANCELLED" ? "secondary" : "outline"}>
                {t.purchaseOrders.statusBadge[po.status]}
              </Badge>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {t.purchaseOrders.detail.kpiPercentReceived}
            </CardTitle>
          </CardHeader>
          <CardContent className="font-mono text-2xl font-semibold">
            {percentReceived}%
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              ({receivedUnits}/{orderedUnits})
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {t.purchaseOrders.detail.kpiTotalValue}
            </CardTitle>
          </CardHeader>
          <CardContent className="font-mono text-2xl font-semibold">
            {formatCurrency(total, {
              locale: region.numberLocale,
              currency: po.currency,
            })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {t.purchaseOrders.detail.kpiLineCount}
            </CardTitle>
          </CardHeader>
          <CardContent className="font-mono text-2xl font-semibold">{po.lines.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {t.purchaseOrders.detail.kpiDaysOpen}
            </CardTitle>
          </CardHeader>
          <CardContent className="font-mono text-2xl font-semibold">{daysOpen}</CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {t.purchaseOrders.detail.metaOrderDate}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {fmtDate(po.orderedAt, region.numberLocale)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {t.purchaseOrders.detail.metaExpectedDate}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {fmtDate(po.expectedAt, region.numberLocale)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {t.purchaseOrders.detail.metaWarehouse}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {po.warehouse.name} <span className="text-muted-foreground">· {po.warehouse.code}</span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t.purchaseOrders.detail.linesHeading}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow>
                  <TableHead>{t.purchaseOrders.detail.columnItem}</TableHead>
                  <TableHead>{t.purchaseOrders.detail.columnSku}</TableHead>
                  <TableHead className="text-right">
                    {t.purchaseOrders.detail.columnOrdered}
                  </TableHead>
                  <TableHead className="text-right">
                    {t.purchaseOrders.detail.columnReceived}
                  </TableHead>
                  <TableHead className="text-right">{t.purchaseOrders.detail.columnOpen}</TableHead>
                  <TableHead className="text-right">
                    {t.purchaseOrders.detail.columnUnitCost}
                  </TableHead>
                  <TableHead className="text-right">
                    {t.purchaseOrders.detail.columnLineTotal}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {po.lines.map((line) => {
                  const unit = Number(line.unitCost);
                  const open = line.orderedQty - line.receivedQty;
                  return (
                    <TableRow key={line.id}>
                      <TableCell className="font-medium">{line.item.name}</TableCell>
                      <TableCell className="font-mono text-xs">{line.item.sku}</TableCell>
                      <TableCell className="text-right font-mono">{line.orderedQty}</TableCell>
                      <TableCell className="text-right font-mono">{line.receivedQty}</TableCell>
                      <TableCell className="text-right font-mono">{open}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(unit, {
                          locale: region.numberLocale,
                          currency: po.currency,
                        })}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(line.orderedQty * unit, {
                          locale: region.numberLocale,
                          currency: po.currency,
                        })}
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow>
                  <TableCell colSpan={6} className="text-right font-semibold">
                    {t.purchaseOrders.totalsLabel}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    {formatCurrency(total, {
                      locale: region.numberLocale,
                      currency: po.currency,
                    })}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Sprint 38: receipts history card. Shows nothing until at
          least one receive event has been posted. */}
      <Card>
        <CardHeader>
          <CardTitle>{t.purchaseOrders.detail.receiptsHeading}</CardTitle>
        </CardHeader>
        <CardContent>
          {receiptEvents.size === 0 ? (
            <p className="text-sm text-muted-foreground">{t.purchaseOrders.detail.receiptsEmpty}</p>
          ) : (
            <ul className="space-y-4">
              {Array.from(receiptEvents.values()).map((event, idx) => (
                <li
                  key={`${event.at.getTime()}-${idx}`}
                  className="rounded-md border border-border/60 p-3"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium">
                      {fmtDateTime(event.at, region.numberLocale)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {event.actorLabel} · {event.warehouseName}{" "}
                      <span className="font-mono">({event.warehouseCode})</span>
                    </p>
                  </div>
                  <ul className="mt-2 space-y-1 text-sm">
                    {event.lines.map((l, lineIdx) => (
                      <li
                        key={`${l.item.id}-${lineIdx}`}
                        className="flex items-center justify-between gap-2 text-muted-foreground"
                      >
                        <span>
                          {l.item.name} <span className="font-mono text-xs">({l.item.sku})</span>
                        </span>
                        <span className="font-mono">+{l.qty}</span>
                      </li>
                    ))}
                  </ul>
                  {event.note ? (
                    <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">
                      {event.note}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Sprint 38: audit trail card scoped to this PO. */}
      <Card>
        <CardHeader>
          <CardTitle>{t.purchaseOrders.detail.auditHeading}</CardTitle>
        </CardHeader>
        <CardContent>
          {scopedAudit.length === 0 ? (
            // Sprint 17 PR #1 (UX/UI audit Apr-25 §B-7): inline ternary empty → EmptyState (bare).
            <EmptyState icon={ClipboardList} title={t.purchaseOrders.detail.auditEmpty} bare />
          ) : (
            <ul className="space-y-2 text-sm">
              {scopedAudit.map((row) => {
                const actorLabel = row.actor
                  ? (row.actor.name ?? row.actor.email)
                  : row.actorId
                    ? t.audit.deletedUser
                    : t.audit.systemActor;
                const details = renderAuditMetadata(row.metadata);
                return (
                  <li
                    key={row.id}
                    className="flex flex-col gap-1 border-b border-border/50 pb-2 last:border-0 last:pb-0"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge variant="secondary" className="font-normal">
                        {auditLabel(row.action, t.audit.actions)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {fmtDateTime(row.createdAt, region.numberLocale)} · {actorLabel}
                      </span>
                    </div>
                    {/* Phase 7.7 — expandable metadata (mirrors audit page) */}
                    {row.metadata ? (
                      <details className="text-xs text-muted-foreground">
                        <summary className="cursor-pointer list-none hover:text-foreground">
                          {details || "Details"}
                        </summary>
                        <pre className="mt-1 overflow-auto rounded bg-muted p-1.5 text-[11px] leading-relaxed max-h-28">
                          {JSON.stringify(row.metadata, null, 2)}
                        </pre>
                      </details>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {po.notes ? (
        <Card>
          <CardHeader>
            <CardTitle>{t.purchaseOrders.detail.notesHeading}</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm">{po.notes}</CardContent>
        </Card>
      ) : null}
    </div>
  );
}
