import { ClipboardList, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    if (state === "IN_PROGRESS") return <Badge className="bg-amber-600">{label}</Badge>;
    if (state === "COMPLETED") return <Badge className="bg-emerald-600">{label}</Badge>;
    return <Badge variant="secondary">{label}</Badge>;
  }

  function renderTable(rows: typeof counts, emptyLabel: string): React.ReactElement {
    if (rows.length === 0) {
      return <p className="px-6 pb-6 text-sm text-muted-foreground">{emptyLabel}</p>;
    }
    return (
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
            <TableRow key={count.id}>
              <TableCell>
                <Link href={`/stock-counts/${count.id}`} className="font-medium hover:underline">
                  {count.name}
                </Link>
                {count.warehouse ? (
                  <div className="text-xs text-muted-foreground">{count.warehouse.name}</div>
                ) : null}
              </TableCell>
              <TableCell>{stateBadge(count.state as CountState)}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {t.stockCounts.methodology[count.methodology as Methodology]}
              </TableCell>
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
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t.stockCounts.heading}</h1>
          <p className="text-muted-foreground">{t.stockCounts.subtitle}</p>
        </div>
        <Button asChild>
          <Link href="/stock-counts/new">
            <Plus className="h-4 w-4" />
            {t.stockCounts.newCount}
          </Link>
        </Button>
      </div>

      {counts.length === 0 ? (
        <Card>
          <CardHeader className="items-center text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <ClipboardList className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle>{t.stockCounts.emptyTitle}</CardTitle>
            <CardDescription>{t.stockCounts.emptyBody}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button asChild>
              <Link href="/stock-counts/new">
                <Plus className="h-4 w-4" />
                {t.stockCounts.emptyCta}
              </Link>
            </Button>
          </CardContent>
        </Card>
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
