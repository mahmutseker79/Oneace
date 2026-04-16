import { CalendarClock, ChevronRight, ExternalLink, Pencil, Plus, Truck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { PageHeader } from "@/components/ui/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/lib/db";
import { format, getMessages, getRegion } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";
import { formatCurrency, formatNumber } from "@/lib/utils";

/**
 * Supplier drill-down detail page — fills the gap Sprint 12 left
 * behind. The supplier-performance report already renders its rows
 * as `<Link href={`/suppliers/${id}`}>`, but until this sprint the
 * only thing living under `/suppliers/[id]/` was `/edit`, so the
 * leaderboard deep-link 404'd.
 *
 * This page gives a procurement / finance operator a single place
 * to answer "how are we doing with this supplier?" without first
 * opening the aggregate report.
 *
 * Layout is three stacked sections:
 *
 *   1. Header card — identity: name + code + active badge, contact
 *      block, address block, website, default currency, notes.
 *      Action buttons: Back, Edit, New PO (the last one dead-ends
 *      at the generic /purchase-orders/new; a future sprint can
 *      add a `?supplierId=` prefill).
 *
 *   2. Activity section — four KPI cards (received value, total
 *      POs, on-time rate, avg lead time) using the exact same math
 *      as the Sprint 12 supplier-performance report so numbers
 *      reconcile between the two surfaces. No denormalized
 *      aggregate table, no scheduled job — one query pulls every
 *      PO + line for this supplier and we roll up in memory. Scale
 *      concerns land after "supplier with 5k historical POs", at
 *      which point we either paginate the recent table and keep
 *      the KPI roll-up over a time window, or add a nightly
 *      aggregate. Not worth the complexity at MVP.
 *
 *   3. Recent POs table — last 10 POs ordered by orderedAt desc,
 *      each row deep-links to `/purchase-orders/[id]`, with
 *      per-row Late/Early/On-time/Outstanding badges driven by the
 *      expectedAt vs receivedAt comparison.
 *
 *   4. Top items card — top 5 items by total ordered quantity
 *      across every PO line for this supplier, with both ordered
 *      and received qty columns so the operator can spot chronic
 *      short-shipments.
 *
 * Scoping / boundaries (mirrors the Sprint 12 report):
 *
 *   - CANCELLED POs count toward "total POs" but contribute zero
 *     received value, zero lead-time sample, and are not eligible
 *     for on-time rate (they never shipped).
 *   - DRAFT POs count toward "total POs" but not toward "open"
 *     (nothing has been committed to the supplier yet).
 *   - On-time rate denominator is *received POs with an expected
 *     date*. POs without expectedAt are excluded from the
 *     denominator, not counted as misses.
 *   - Received value is sum(receivedQty × unitCost) across every
 *     line regardless of PO status — a PARTIALLY_RECEIVED PO
 *     contributes its shipped-so-far value.
 *   - Lead time uses calendar days (Math.round) — partial days are
 *     noise for procurement decisions.
 *   - Currency totals render in the region currency. If the
 *     supplier has POs in multiple currencies or any non-region
 *     currency, a caveat explains the 1:1 conversion.
 *
 * Defense-in-depth: `findFirst` with `{ id, organizationId }` so a
 * crafted URL with a supplier id belonging to a different tenant
 * trips `notFound()` even though the route is gated by
 * `requireActiveMembership` upstream.
 */

type DetailPageProps = {
  params: Promise<{ id: string }>;
};

const RECENT_PO_LIMIT = 10;
const TOP_ITEM_LIMIT = 5;

export async function generateMetadata({ params }: DetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const t = await getMessages();
  const { membership } = await requireActiveMembership();
  const supplier = await db.supplier.findFirst({
    where: { id, organizationId: membership.organizationId },
    select: { name: true },
  });
  return {
    title: supplier
      ? `${supplier.name} — ${t.suppliers.detail.metaTitle}`
      : t.suppliers.detail.metaTitle,
  };
}

function avg(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const sum = xs.reduce((a, b) => a + b, 0);
  return sum / xs.length;
}

function fmtDate(value: Date | null | undefined, locale: string): string | null {
  if (!value) return null;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(value);
}

type PoStatus = "DRAFT" | "SENT" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED";

function statusVariant(status: PoStatus): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "RECEIVED":
      return "default";
    case "SENT":
    case "PARTIALLY_RECEIVED":
      return "secondary";
    case "DRAFT":
      return "outline";
    case "CANCELLED":
      return "destructive";
  }
}

export default async function SupplierDetailPage({ params }: DetailPageProps) {
  const { id } = await params;
  const { membership } = await requireActiveMembership();
  const t = await getMessages();
  const region = await getRegion();

  // Phase 8.8 — role check for edit/create actions.
  const canEditSupplier = hasCapability(membership.role, "suppliers.edit");
  const canCreatePO = hasCapability(membership.role, "purchaseOrders.create");

  const supplier = await db.supplier.findFirst({
    where: { id, organizationId: membership.organizationId },
    include: {
      purchaseOrders: {
        orderBy: { orderedAt: "desc" },
        select: {
          id: true,
          poNumber: true,
          status: true,
          currency: true,
          orderedAt: true,
          expectedAt: true,
          receivedAt: true,
          lines: {
            select: {
              orderedQty: true,
              receivedQty: true,
              unitCost: true,
              item: { select: { id: true, name: true, sku: true } },
            },
          },
        },
      },
    },
  });

  if (!supplier) {
    notFound();
  }

  // KPI roll-up — same math as /reports/suppliers (Sprint 12)
  // so the leaderboard and this page reconcile byte-for-byte.
  let receivedValue = 0;
  let openPos = 0;
  let onTimeEligible = 0;
  let onTimeCount = 0;
  const leadTimeSampleDays: number[] = [];
  const currencyMix = new Set<string>();

  // Top-items aggregation map: itemId → { name, sku, ordered, received }.
  const itemTotals = new Map<
    string,
    { name: string; sku: string; ordered: number; received: number }
  >();

  for (const po of supplier.purchaseOrders) {
    currencyMix.add(po.currency);

    if (po.status === "SENT" || po.status === "PARTIALLY_RECEIVED") {
      openPos += 1;
    }

    for (const line of po.lines) {
      const unit = Number(line.unitCost.toString());
      receivedValue += line.receivedQty * unit;

      const existing = itemTotals.get(line.item.id);
      if (existing) {
        existing.ordered += line.orderedQty;
        existing.received += line.receivedQty;
      } else {
        itemTotals.set(line.item.id, {
          name: line.item.name,
          sku: line.item.sku,
          ordered: line.orderedQty,
          received: line.receivedQty,
        });
      }
    }

    if (po.status === "RECEIVED" && po.receivedAt) {
      const orderedMs = po.orderedAt.getTime();
      const receivedMs = po.receivedAt.getTime();
      const leadDays = Math.round((receivedMs - orderedMs) / (1000 * 60 * 60 * 24));
      if (leadDays >= 0) {
        leadTimeSampleDays.push(leadDays);
      }

      if (po.expectedAt) {
        onTimeEligible += 1;
        if (receivedMs <= po.expectedAt.getTime()) {
          onTimeCount += 1;
        }
      }
    }
  }

  const totalPos = supplier.purchaseOrders.length;
  const onTimeRate = onTimeEligible === 0 ? null : (onTimeCount / onTimeEligible) * 100;
  const avgLead = avg(leadTimeSampleDays);

  const showCurrencyCaveat =
    currencyMix.size > 1 || Array.from(currencyMix).some((c) => c !== region.currency);

  const topItems = Array.from(itemTotals.values())
    .sort((a, b) => b.ordered - a.ordered)
    .slice(0, TOP_ITEM_LIMIT);

  const recentPos = supplier.purchaseOrders.slice(0, RECENT_PO_LIMIT);

  const hasActivity = totalPos > 0;
  const locale = region.numberLocale;

  const addressParts = [
    supplier.addressLine1,
    supplier.addressLine2,
    [supplier.postalCode, supplier.city].filter(Boolean).join(" ").trim(),
    supplier.region,
    supplier.country,
  ].filter((part): part is string => Boolean(part && part.trim().length > 0));

  return (
    <div className="space-y-6">
      <PageHeader
        title={supplier.name}
        backHref="/suppliers"
        breadcrumb={[{ label: "Suppliers", href: "/suppliers" }, { label: supplier.name }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canEditSupplier ? (
              <Button asChild variant="outline">
                <Link href={`/suppliers/${supplier.id}/edit`}>
                  <Pencil className="h-4 w-4" />
                  {t.suppliers.detail.editCta}
                </Link>
              </Button>
            ) : null}
            {canCreatePO ? (
              <Button asChild>
                <Link href={`/purchase-orders/new?supplier=${supplier.id}`}>
                  <Plus className="h-4 w-4" />
                  {t.suppliers.detail.newPoCta}
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t.suppliers.detail.contactHeading}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {supplier.contactName || supplier.email || supplier.phone ? (
              <dl className="space-y-1">
                {supplier.contactName ? <dd>{supplier.contactName}</dd> : null}
                {supplier.email ? (
                  <dd className="text-muted-foreground">
                    <a href={`mailto:${supplier.email}`} className="hover:underline">
                      {supplier.email}
                    </a>
                  </dd>
                ) : null}
                {supplier.phone ? (
                  <dd className="text-muted-foreground">{supplier.phone}</dd>
                ) : null}
                {supplier.website ? (
                  <dd className="text-muted-foreground">
                    <a
                      href={supplier.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 hover:underline"
                    >
                      {t.suppliers.detail.websiteLabel}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </dd>
                ) : null}
              </dl>
            ) : (
              <p className="text-muted-foreground italic">{t.suppliers.detail.noContact}</p>
            )}
            <p className="text-muted-foreground mt-3 text-xs">
              {t.suppliers.detail.currencyLabel}:{" "}
              <span className="font-mono">{supplier.currency}</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t.suppliers.detail.addressHeading}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {addressParts.length > 0 ? (
              <address className="not-italic">
                {addressParts.map((part) => (
                  <div key={part}>{part}</div>
                ))}
              </address>
            ) : (
              <p className="text-muted-foreground italic">{t.suppliers.detail.noAddress}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t.suppliers.detail.notesHeading}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {supplier.notes && supplier.notes.trim().length > 0 ? (
              <p className="whitespace-pre-wrap">{supplier.notes}</p>
            ) : (
              <p className="text-muted-foreground italic">{t.suppliers.detail.noNotes}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-semibold">{t.suppliers.detail.activityHeading}</h2>
        <p className="text-muted-foreground text-sm">{t.suppliers.detail.activitySubtitle}</p>
      </div>

      {!hasActivity ? (
        <Card>
          <CardHeader className="items-center text-center">
            <div className="bg-muted mx-auto flex h-12 w-12 items-center justify-center rounded-full">
              <CalendarClock className="text-muted-foreground h-6 w-6" />
            </div>
            <CardTitle>{t.suppliers.detail.emptyActivityTitle}</CardTitle>
            <CardDescription>{t.suppliers.detail.emptyActivityBody}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button asChild>
              <Link href="/purchase-orders/new">
                <Plus className="h-4 w-4" />
                {t.suppliers.detail.newPoCta}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>{t.suppliers.detail.kpiReceivedValueLabel}</CardDescription>
                <CardTitle className="text-2xl">
                  {formatCurrency(receivedValue, { currency: region.currency })}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground text-xs">
                {t.suppliers.detail.kpiReceivedValueBody}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>{t.suppliers.detail.kpiTotalPosLabel}</CardDescription>
                <CardTitle className="text-2xl">{formatNumber(totalPos)}</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground text-xs">
                {format(t.suppliers.detail.kpiTotalPosBody, {
                  open: String(openPos),
                })}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>{t.suppliers.detail.kpiOnTimeRateLabel}</CardDescription>
                <CardTitle className="text-2xl">
                  {onTimeRate == null
                    ? t.suppliers.detail.kpiNotAvailable
                    : `${onTimeRate.toFixed(0)}%`}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground text-xs">
                {format(t.suppliers.detail.kpiOnTimeRateBody, {
                  sample: String(onTimeCount),
                  eligible: String(onTimeEligible),
                })}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>{t.suppliers.detail.kpiAvgLeadTimeLabel}</CardDescription>
                <CardTitle className="text-2xl">
                  {avgLead == null
                    ? t.suppliers.detail.kpiNotAvailable
                    : format(t.suppliers.detail.daysSuffix, {
                        days: avgLead.toFixed(1),
                      })}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground text-xs">
                {format(t.suppliers.detail.kpiAvgLeadTimeBody, {
                  count: String(leadTimeSampleDays.length),
                })}
              </CardContent>
            </Card>
          </div>

          {showCurrencyCaveat ? (
            <p className="text-muted-foreground text-xs italic">
              {format(t.suppliers.detail.mixedCurrencyCaveat, {
                currency: region.currency,
              })}
            </p>
          ) : null}

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{t.suppliers.detail.recentHeading}</CardTitle>
                  <CardDescription>{t.suppliers.detail.recentSubtitle}</CardDescription>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/purchase-orders">
                    {t.suppliers.detail.recentViewAllCta}
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.suppliers.detail.colPoNumber}</TableHead>
                    <TableHead>{t.suppliers.detail.colStatus}</TableHead>
                    <TableHead>{t.suppliers.detail.colOrderedAt}</TableHead>
                    <TableHead>{t.suppliers.detail.colExpectedAt}</TableHead>
                    <TableHead>{t.suppliers.detail.colReceivedAt}</TableHead>
                    <TableHead className="text-right">{t.suppliers.detail.colLines}</TableHead>
                    <TableHead className="text-right">{t.suppliers.detail.colValue}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentPos.map((po) => {
                    const status = po.status as PoStatus;
                    const poValue = po.lines.reduce(
                      (sum, line) => sum + line.receivedQty * Number(line.unitCost.toString()),
                      0,
                    );
                    // Per-row timeliness badge: only meaningful on
                    // received POs with an expectedAt date; outstanding
                    // POs show "Outstanding", cancelled POs show
                    // nothing.
                    let timelinessBadge: React.ReactNode = null;
                    if (status === "RECEIVED" && po.receivedAt && po.expectedAt) {
                      const diff = po.receivedAt.getTime() - po.expectedAt.getTime();
                      if (diff > 0) {
                        timelinessBadge = (
                          <Badge variant="destructive">{t.suppliers.detail.lateBadge}</Badge>
                        );
                      } else if (diff < 0) {
                        timelinessBadge = (
                          <Badge variant="secondary">{t.suppliers.detail.earlyBadge}</Badge>
                        );
                      } else {
                        timelinessBadge = <Badge>{t.suppliers.detail.onTimeBadge}</Badge>;
                      }
                    } else if (status === "SENT" || status === "PARTIALLY_RECEIVED") {
                      timelinessBadge = (
                        <Badge variant="outline">{t.suppliers.detail.outstandingBadge}</Badge>
                      );
                    }

                    return (
                      <TableRow key={po.id}>
                        <TableCell className="font-mono text-xs">
                          <Link href={`/purchase-orders/${po.id}`} className="hover:underline">
                            {po.poNumber}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1">
                            <Badge variant={statusVariant(status)}>
                              {t.purchaseOrders.statusBadge[status]}
                            </Badge>
                            {timelinessBadge}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {fmtDate(po.orderedAt, locale) ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {fmtDate(po.expectedAt, locale) ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {fmtDate(po.receivedAt, locale) ?? "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(po.lines.length)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(poValue, {
                            currency: region.currency,
                          })}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.suppliers.detail.topItemsHeading}</CardTitle>
              <CardDescription>{t.suppliers.detail.topItemsSubtitle}</CardDescription>
            </CardHeader>
            <CardContent>
              {topItems.length === 0 ? (
                <p className="text-muted-foreground text-sm italic">
                  {t.suppliers.detail.topItemsEmpty}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.suppliers.detail.colItem}</TableHead>
                      <TableHead className="text-right">
                        {t.suppliers.detail.colOrderedQty}
                      </TableHead>
                      <TableHead className="text-right">
                        {t.suppliers.detail.colReceivedQty}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topItems.map((row) => (
                      <TableRow key={row.sku}>
                        <TableCell>
                          <div className="font-medium">{row.name}</div>
                          <div className="text-muted-foreground font-mono text-xs">{row.sku}</div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(row.ordered)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(row.received)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
