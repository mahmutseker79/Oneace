import { Plus, Truck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AdvancedFeatureBanner } from "@/components/shell/advanced-feature-banner";
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
import { getMessages } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";

import { deleteSupplierAction } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.suppliers.metaTitle };
}

export default async function SuppliersPage() {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

  const suppliers = await db.supplier.findMany({
    where: { organizationId: membership.organizationId },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-6">
      <AdvancedFeatureBanner labels={t.advancedFeature} />

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t.suppliers.heading}</h1>
          <p className="text-muted-foreground">{t.suppliers.subtitle}</p>
        </div>
        <Button asChild>
          <Link href="/suppliers/new">
            <Plus className="h-4 w-4" />
            {t.suppliers.newSupplier}
          </Link>
        </Button>
      </div>

      {suppliers.length === 0 ? (
        <Card>
          <CardHeader className="items-center text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Truck className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle>{t.suppliers.emptyTitle}</CardTitle>
            <CardDescription>{t.suppliers.emptyBody}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button asChild>
              <Link href="/suppliers/new">
                <Plus className="h-4 w-4" />
                {t.suppliers.emptyCta}
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
                  <TableHead>{t.suppliers.columnName}</TableHead>
                  <TableHead>{t.suppliers.columnCode}</TableHead>
                  <TableHead>{t.suppliers.columnContact}</TableHead>
                  <TableHead>{t.suppliers.columnCountry}</TableHead>
                  <TableHead>{t.suppliers.columnStatus}</TableHead>
                  <TableHead className="w-36 text-right">{t.suppliers.columnActions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      <Link href={`/suppliers/${s.id}`} className="hover:underline">
                        {s.name}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{s.code ?? t.common.none}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.contactName ?? s.email ?? t.common.none}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.country ?? t.common.none}
                    </TableCell>
                    <TableCell>
                      {s.isActive ? (
                        <Badge>{t.suppliers.activeLabel}</Badge>
                      ) : (
                        <Badge variant="secondary">{t.suppliers.inactiveLabel}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/suppliers/${s.id}/edit`}>{t.common.edit}</Link>
                        </Button>
                        <DeleteButton
                          labels={{
                            trigger: t.common.delete,
                            title: t.suppliers.deleteConfirmTitle,
                            body: t.suppliers.deleteConfirmBody,
                            cancel: t.common.cancel,
                            confirm: t.common.delete,
                          }}
                          action={deleteSupplierAction.bind(null, s.id)}
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
    </div>
  );
}
