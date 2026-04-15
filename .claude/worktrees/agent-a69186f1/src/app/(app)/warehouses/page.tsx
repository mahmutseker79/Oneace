import { Package, Plus, Warehouse as WarehouseIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PicklistCacheSync } from "@/components/offline/picklist-cache-sync";
import { DeleteButton } from "@/components/shell/delete-button";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import type { WarehouseSnapshotRow } from "@/lib/offline/warehouses-cache";
import { requireActiveMembership } from "@/lib/session";

import { deleteWarehouseAction } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.warehouses.metaTitle };
}

function formatLocation(parts: Array<string | null | undefined>, fallback: string): string {
  const clean = parts.filter((part): part is string => !!part);
  return clean.length > 0 ? clean.join(", ") : fallback;
}

export default async function WarehousesPage() {
  const { membership, session } = await requireActiveMembership();
  const t = await getMessages();

  const warehouses = await db.warehouse.findMany({
    where: { organizationId: membership.organizationId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });

  // Build the serializable snapshot the picklist sync writes to
  // Dexie. Keeping this in the page itself (vs. inside a helper)
  // makes the dependency on Prisma's row shape explicit.
  const cacheScope = {
    orgId: membership.organizationId,
    userId: session.user.id,
  };
  const cacheRows: WarehouseSnapshotRow[] = warehouses.map((w) => ({
    id: w.id,
    name: w.name,
    code: w.code,
    city: w.city,
    region: w.region,
    country: w.country,
    isDefault: w.isDefault,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t.warehouses.heading}</h1>
          <p className="text-muted-foreground">{t.warehouses.subtitle}</p>
        </div>
        <Button asChild>
          <Link href="/warehouses/new">
            <Plus className="h-4 w-4" />
            {t.warehouses.newWarehouse}
          </Link>
        </Button>
      </div>

      {warehouses.length === 0 ? (
        <Card>
          <CardHeader className="items-center text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <WarehouseIcon className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle>{t.warehouses.emptyTitle}</CardTitle>
            <CardDescription>{t.warehouses.emptyBody}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-2">
            <Button asChild>
              <Link href="/warehouses/new">
                <Plus className="h-4 w-4" />
                {t.warehouses.emptyCta}
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/items">
                <Package className="h-4 w-4" />
                {t.warehouses.emptyItemsCta}
              </Link>
            </Button>
          </CardContent>
          <CardFooter className="justify-center border-t px-6 py-3">
            <p className="text-xs text-muted-foreground">{t.warehouses.emptyHint}</p>
          </CardFooter>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.warehouses.columnName}</TableHead>
                  <TableHead>{t.warehouses.columnCode}</TableHead>
                  <TableHead>{t.warehouses.columnLocation}</TableHead>
                  <TableHead>{t.warehouses.columnDefault}</TableHead>
                  <TableHead className="w-36 text-right">{t.warehouses.columnActions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {warehouses.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="font-medium">{w.name}</TableCell>
                    <TableCell className="font-mono text-xs">{w.code}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatLocation([w.city, w.region, w.country], t.common.none)}
                    </TableCell>
                    <TableCell>{w.isDefault ? <Badge>{t.common.yes}</Badge> : null}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/warehouses/${w.id}/edit`}>{t.common.edit}</Link>
                        </Button>
                        <DeleteButton
                          labels={{
                            trigger: t.common.delete,
                            title: t.warehouses.deleteConfirmTitle,
                            body: t.warehouses.deleteConfirmBody,
                            cancel: t.common.cancel,
                            confirm: t.common.delete,
                          }}
                          action={deleteWarehouseAction.bind(null, w.id)}
                          iconOnly
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <PicklistCacheSync table="warehouses" scope={cacheScope} rows={cacheRows} />
    </div>
  );
}
