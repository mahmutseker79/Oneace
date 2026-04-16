import { ClipboardList, Package, Plus, Warehouse } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
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

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.stockCounts.metaTitle };
}

export default async function StockCountsPage() {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();
  const region = await getRegion();

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
      return <p className="px-6 pb-6 text-sm text-muted-foreground">{emptyLabel}</p>;
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
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {t.stockCounts.heading}
          </h1>
          <p className="text-sm text-muted-foreground">{t.stockCounts.subtitle}</p>
        </div>
        {canCreate ? (
          <Button asChild>
            <Link href="/stock-counts/new">
              <Plus className="h-4 w-4" />
              {t.stockCounts.newCount}
            </Link>
          </Button>
        ) : null}
      </div>

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
          <Card>
            <CardHeader>
              <CardTitle>{t.stockCounts.inProgressHeading}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {renderTable(inProgress, t.stockCounts.inProgressEmpty)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t.stockCounts.closedHeading}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {renderTable(closed, t.stockCounts.closedEmpty)}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
