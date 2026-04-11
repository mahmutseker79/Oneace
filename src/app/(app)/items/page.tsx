import { Download, Eye, FileUp, Package, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DeleteButton } from "@/components/shell/delete-button";
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
import { formatCurrency } from "@/lib/utils";

import { deleteItemAction } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.items.metaTitle };
}

export default async function ItemsPage() {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();
  const region = await getRegion();

  const items = await db.item.findMany({
    where: { organizationId: membership.organizationId },
    include: {
      category: { select: { id: true, name: true } },
      stockLevels: { select: { quantity: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  function statusBadge(status: "ACTIVE" | "ARCHIVED" | "DRAFT") {
    if (status === "ACTIVE") {
      return <Badge>{t.common.active}</Badge>;
    }
    if (status === "DRAFT") {
      return <Badge variant="outline">{t.common.draft}</Badge>;
    }
    return <Badge variant="secondary">{t.common.archived}</Badge>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t.items.heading}</h1>
          <p className="text-muted-foreground">{t.items.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/items/export">
              <Download className="h-4 w-4" />
              {t.common.exportCsv}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/items/import">
              <FileUp className="h-4 w-4" />
              {t.items.importCta}
            </Link>
          </Button>
          <Button asChild>
            <Link href="/items/new">
              <Plus className="h-4 w-4" />
              {t.items.newItem}
            </Link>
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardHeader className="items-center text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Package className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle>{t.items.emptyTitle}</CardTitle>
            <CardDescription>{t.items.emptyBody}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button asChild>
              <Link href="/items/new">
                <Plus className="h-4 w-4" />
                {t.items.emptyCta}
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
                  <TableHead>{t.items.columnSku}</TableHead>
                  <TableHead>{t.items.columnName}</TableHead>
                  <TableHead>{t.items.columnCategory}</TableHead>
                  <TableHead className="text-right">{t.items.columnStock}</TableHead>
                  <TableHead>{t.items.columnStatus}</TableHead>
                  <TableHead className="w-36 text-right">{t.items.columnActions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const onHand = item.stockLevels.reduce((sum, level) => sum + level.quantity, 0);
                  const price = item.salePrice
                    ? formatCurrency(Number(item.salePrice), {
                        currency: item.currency,
                        locale: region.numberLocale,
                      })
                    : null;
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                      <TableCell>
                        <Link href={`/items/${item.id}`} className="font-medium hover:underline">
                          {item.name}
                        </Link>
                        {price ? (
                          <div className="text-xs text-muted-foreground">{price}</div>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.category?.name ?? t.common.none}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {onHand} {item.unit}
                      </TableCell>
                      <TableCell>{statusBadge(item.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/items/${item.id}`} aria-label={t.common.search}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/items/${item.id}/edit`}>{t.common.edit}</Link>
                          </Button>
                          <DeleteButton
                            labels={{
                              trigger: t.common.delete,
                              title: t.items.deleteConfirmTitle,
                              body: t.items.deleteConfirmBody,
                              cancel: t.common.cancel,
                              confirm: t.common.delete,
                            }}
                            action={deleteItemAction.bind(null, item.id)}
                            iconOnly
                          />
                        </div>
                      </TableCell>
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
