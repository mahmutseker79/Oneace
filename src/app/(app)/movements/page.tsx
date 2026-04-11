import { ArrowLeftRight, Download, Plus } from "lucide-react";
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

type MovementType = "RECEIPT" | "ISSUE" | "ADJUSTMENT" | "TRANSFER" | "COUNT";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.movements.metaTitle };
}

export default async function MovementsPage() {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();
  const region = await getRegion();

  const movements = await db.stockMovement.findMany({
    where: { organizationId: membership.organizationId },
    include: {
      item: { select: { id: true, sku: true, name: true, unit: true } },
      warehouse: { select: { id: true, name: true, code: true } },
      toWarehouse: { select: { id: true, name: true, code: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const dateFormatter = new Intl.DateTimeFormat(region.numberLocale, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  function typeBadge(type: MovementType) {
    const label = t.movements.types[type];
    if (type === "RECEIPT") return <Badge className="bg-emerald-600">{label}</Badge>;
    if (type === "ISSUE") return <Badge variant="destructive">{label}</Badge>;
    if (type === "ADJUSTMENT") return <Badge variant="secondary">{label}</Badge>;
    if (type === "TRANSFER") return <Badge variant="outline">{label}</Badge>;
    return <Badge variant="outline">{label}</Badge>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t.movements.heading}</h1>
          <p className="text-muted-foreground">{t.movements.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/movements/export">
              <Download className="h-4 w-4" />
              {t.common.exportCsv}
            </Link>
          </Button>
          <Button asChild>
            <Link href="/movements/new">
              <Plus className="h-4 w-4" />
              {t.movements.newMovement}
            </Link>
          </Button>
        </div>
      </div>

      {movements.length === 0 ? (
        <Card>
          <CardHeader className="items-center text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <ArrowLeftRight className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle>{t.movements.emptyTitle}</CardTitle>
            <CardDescription>{t.movements.emptyBody}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button asChild>
              <Link href="/movements/new">
                <Plus className="h-4 w-4" />
                {t.movements.emptyCta}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.movements.columnDate}</TableHead>
                  <TableHead>{t.movements.columnItem}</TableHead>
                  <TableHead>{t.movements.columnType}</TableHead>
                  <TableHead>{t.movements.columnWarehouse}</TableHead>
                  <TableHead className="text-right">{t.movements.columnQuantity}</TableHead>
                  <TableHead>{t.movements.columnReference}</TableHead>
                  <TableHead>{t.movements.columnUser}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((m) => {
                  const signedQty = m.direction < 0 ? -m.quantity : m.quantity;
                  const qtyPrefix =
                    signedQty > 0 ? t.movements.directionIn : t.movements.directionOut;
                  const absQty = Math.abs(signedQty);
                  const warehouseCell =
                    m.type === "TRANSFER" && m.toWarehouse
                      ? `${m.warehouse.name} ${t.movements.transferLabel} ${m.toWarehouse.name}`
                      : m.warehouse.name;
                  const userLabel =
                    m.createdBy?.name ?? m.createdBy?.email ?? t.movements.unknownUser;
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {dateFormatter.format(m.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Link href={`/items/${m.item.id}`} className="font-medium hover:underline">
                          {m.item.name}
                        </Link>
                        <div className="font-mono text-xs text-muted-foreground">{m.item.sku}</div>
                      </TableCell>
                      <TableCell>{typeBadge(m.type as MovementType)}</TableCell>
                      <TableCell className="text-sm">{warehouseCell}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span className={signedQty >= 0 ? "text-emerald-600" : "text-destructive"}>
                          {qtyPrefix}
                          {absQty} {m.item.unit}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {m.reference ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{userLabel}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
