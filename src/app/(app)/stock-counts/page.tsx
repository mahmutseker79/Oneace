import { ClipboardList, Package, Plus, Warehouse } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { MobileCard, ResponsiveTable } from "@/components/ui/responsive-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/lib/db";
import { getMessages, getRegion } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";

type CountState = "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
type Methodology = "CYCLE" | "FULL" | "SPOT" | "BLIND" | "DOUBLE_BLIND" | "DIRECTED";

// v1.5 step 8 — state filter tabs on /stock-counts landing.
// Three buckets per nav brief: Active (open/in-progress), Scheduled
// (reserved — not yet modelled in Prisma, shows empty placeholder so
// the tab is still discoverable), History (completed/cancelled).
type StateFilter = "all" | "active" | "scheduled" | "history";

type SearchParams = Promise<{ state?: string }>;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.stockCounts.metaTitle };
}

export default async function StockCountsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();
  const region = await getRegion();

  const params = (await searchParams) ?? {};
  const rawState = (params.state ?? "all").toLowerCase();
  const stateFilter: StateFilter =
    rawState === "active" || rawState === "scheduled" || rawState === "history"
      ? (rawState as StateFilter)
      : "all";

  // P10.1 — capability flag for conditional UI rendering
  const canCreate = hasCapability(membership.role, "stockCounts.create");

  const counts = await db.stockCount.findMany({
    where: { organizationId: membership.organizationId },
    include: {
      warehouse: { select: { id: true, name: true, code: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      _count: { select: { entries: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const dateFormatter = new Intl.DateTimeFormat(region.numberLocale, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const inProgress = counts.filter((c) => c.state === "OPEN" || c.state === "IN_PROGRESS");
  const closed = counts.filter((c) => c.state === "COMPLETED" || c.state === "CANCELLED");

  function stateBadge(state: CountState) {
    const label = t.stockCounts.statusBadge[state];
    if (state === "OPEN") return <Badge variant="outline">{label}</Badge>;
    if (state === "IN_PROGRESS") return <Badge variant="processing">{label}</Badge>;
    if (state === "COMPLETED") return <Badge variant="success">{label}</Badge>;
    return <Badge variant="secondary">{label}</Badge>;
  }

  function methodologyBadge(methodology: Methodology) {
    return (
      <Badge
        variant="outline"
        className="bg-muted text-xs font-mono rounded px-1.5 py-0.5 border-0"
      >
        {t.stockCounts.methodology[methodology]}
      </Badge>
    );
  }

  function renderTable(rows: typeof counts, emptyLabel: string): React.ReactElement {
    if (rows.length === 0) {
      return <EmptyState bare icon={ClipboardList} title={emptyLabel} />;
    }

    const cardView = rows.map((count) => (
      <MobileCard
        key={count.id}
        href={`/stock-counts/${count.id}`}
        title={count.name}
        badge={stateBadge(count.state as CountState)}
        fields={[
          {
            label: t.stockCounts.columnMethodology,
            value: t.stockCounts.methodology[count.methodology as Methodology],
          },
          {
            label: t.stockCounts.columnCreated,
            value: dateFormatter.format(count.createdAt),
          },
        ]}
      />
    ));

    return (
      <ResponsiveTable cardView={cardView}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.stockCounts.columnName}</TableHead>
              <TableHead>{t.stockCounts.columnState}</TableHead>
              <TableHead>{t.stockCounts.columnMethodology}</TableHead>
              <TableHead>{t.stockCounts.columnCreated}</TableHead>
              <TableHead className="text-right">{t.stockCounts.columnProgress}</TableHead>
              <TableHead>{t.stockCounts.columnCreatedBy}</TableHead>
              <TableHead className="w-20 text-right">{t.stockCounts.columnAction}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((count) => (
              <TableRow key={count.id} className="hover:bg-muted/50 transition-colors">
                <TableCell>
                  <Link href={`/stock-counts/${count.id}`} className="font-medium hover:underline">
                    {count.name}
                  </Link>
                  {count.warehouse ? (
                    <div className="text-xs text-muted-foreground">{count.warehouse.name}</div>
                  ) : null}
                </TableCell>
                <TableCell>{stateBadge(count.state as CountState)}</TableCell>
                <TableCell>{methodologyBadge(count.methodology as Methodology)}</TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {dateFormatter.format(count.createdAt)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{count._count.entries}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {count.createdBy?.name ?? count.createdBy?.email ?? t.movements.unknownUser}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/stock-counts/${count.id}`}>{t.stockCounts.openAction}</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ResponsiveTable>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.stockCounts.heading}
        description={t.stockCounts.subtitle}
        actions={
          canCreate ? (
            <Button asChild>
              <Link href="/stock-counts/new">
                <Plus className="h-4 w-4" />
                {t.stockCounts.newCount}
              </Link>
            </Button>
          ) : undefined
        }
      />

      {counts.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={t.stockCounts.emptyTitle}
          description={t.stockCounts.emptyBody}
          actions={[
            ...(canCreate
              ? [{ label: t.stockCounts.emptyCta, href: "/stock-counts/new", icon: Plus }]
              : []),
            {
              label: t.stockCounts.emptyItemsCta,
              href: "/items",
              icon: Package,
              variant: "secondary" as const,
            },
            {
              label: t.stockCounts.emptyLocationsCta,
              href: "/warehouses",
              icon: Warehouse,
              variant: "secondary" as const,
            },
          ]}
          footer={t.stockCounts.emptyPrereq}
        />
      ) : (
        <div className="space-y-6">
          {/* v1.5 step 8 — state filter strip. Same visual shape as the
              wrapper-tabs row used elsewhere so /stock-counts reads
              like the rest of the primary surfaces. */}
          <div className="flex gap-2 border-b">
            {[
              { value: "all", label: "All" },
              { value: "active", label: "Active" },
              { value: "scheduled", label: "Scheduled" },
              { value: "history", label: "History" },
            ].map((s) => (
              <Link
                key={s.value}
                href={s.value === "all" ? "/stock-counts" : `/stock-counts?state=${s.value}`}
                className={`px-4 py-2 text-sm border-b-2 transition-colors ${
                  stateFilter === s.value
                    ? "border-primary text-primary font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {s.label}
              </Link>
            ))}
          </div>

          {stateFilter === "scheduled" ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Scheduled counts aren&apos;t supported yet. Create an active count from the button
                above.
              </CardContent>
            </Card>
          ) : null}

          {stateFilter === "all" || stateFilter === "active" ? (
            <Card>
              <CardHeader>
                <CardTitle>{t.stockCounts.inProgressHeading}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {renderTable(inProgress, t.stockCounts.inProgressEmpty)}
              </CardContent>
            </Card>
          ) : null}

          {stateFilter === "all" || stateFilter === "history" ? (
            <Card>
              <CardHeader>
                <CardTitle>{t.stockCounts.closedHeading}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {renderTable(closed, t.stockCounts.closedEmpty)}
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}
