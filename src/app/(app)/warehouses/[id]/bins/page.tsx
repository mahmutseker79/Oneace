import { ArrowLeft, Grid3X3, Plus, Printer } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DeleteButton } from "@/components/shell/delete-button";
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

import { deleteBinAction } from "./actions";
import { BinFormDialog } from "./bin-form-dialog";
import { BinTransferDialog } from "./bin-transfer-dialog";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.bins.metaTitle };
}

export default async function BinsPage({ params }: PageProps) {
  const { id: warehouseId } = await params;
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

  const warehouse = await db.warehouse.findFirst({
    where: { id: warehouseId, organizationId: membership.organizationId },
    select: { id: true, name: true, code: true },
  });

  if (!warehouse) {
    notFound();
  }

  const [bins, items] = await Promise.all([
    db.bin.findMany({
      where: { warehouseId },
      orderBy: { code: "asc" },
    }),
    db.item.findMany({
      where: { organizationId: membership.organizationId },
      select: { id: true, sku: true, name: true },
      orderBy: { name: "asc" },
      take: 500,
    }),
  ]);

  const formLabels = {
    code: t.bins.fields.code,
    codeHelp: t.bins.fields.codeHelp,
    label: t.bins.fields.label,
    labelHelp: t.bins.fields.labelHelp,
    description: t.bins.fields.description,
    save: t.common.save,
    cancel: t.common.cancel,
    newBin: t.bins.newBin,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/warehouses/${warehouseId}`}>
            <ArrowLeft className="h-4 w-4" />
            {warehouse.name}
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t.bins.heading}</h1>
          <p className="text-muted-foreground">{t.bins.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {bins.length > 0 ? (
            <Button variant="outline" asChild>
              <Link href={`/warehouses/${warehouseId}/bins/print`} target="_blank">
                <Printer className="h-4 w-4" />
                {t.bins.printLabels}
              </Link>
            </Button>
          ) : null}
          <BinTransferDialog
            warehouseId={warehouseId}
            labels={{
              title: t.bins.transfer.title,
              trigger: t.bins.transfer.trigger,
              item: t.bins.transfer.item,
              fromBin: t.bins.transfer.fromBin,
              toBin: t.bins.transfer.toBin,
              quantity: t.bins.transfer.quantity,
              submit: t.bins.transfer.submit,
              cancel: t.common.cancel,
            }}
            bins={bins.map((b) => ({ id: b.id, code: b.code, label: b.label }))}
            items={items}
          />
          <BinFormDialog warehouseId={warehouseId} labels={formLabels} mode="create" />
        </div>
      </div>

      {bins.length === 0 ? (
        <Card>
          <CardHeader className="items-center text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Grid3X3 className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle>{t.bins.emptyTitle}</CardTitle>
            <CardDescription>{t.bins.emptyBody}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-2">
            <BinFormDialog warehouseId={warehouseId} labels={formLabels} mode="create" />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.bins.columnCode}</TableHead>
                  <TableHead>{t.bins.columnLabel}</TableHead>
                  <TableHead className="w-36 text-right">{t.bins.columnActions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bins.map((bin) => (
                  <TableRow key={bin.id}>
                    <TableCell className="font-mono text-xs">{bin.code}</TableCell>
                    <TableCell className="text-muted-foreground">{bin.label || "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <BinFormDialog
                          warehouseId={warehouseId}
                          labels={formLabels}
                          mode="edit"
                          bin={{
                            id: bin.id,
                            code: bin.code,
                            label: bin.label,
                            description: bin.description,
                          }}
                        />
                        <DeleteButton
                          labels={{
                            trigger: t.common.delete,
                            title: t.bins.deleteConfirmTitle,
                            body: t.bins.deleteConfirmBody,
                            cancel: t.common.cancel,
                            confirm: t.common.delete,
                          }}
                          action={deleteBinAction.bind(null, warehouseId, bin.id)}
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
