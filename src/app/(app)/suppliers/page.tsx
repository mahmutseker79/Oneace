import { Plus, Truck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AdvancedFeatureBanner } from "@/components/shell/advanced-feature-banner";
import { DeleteButton } from "@/components/shell/delete-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { getMessages } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";

import { deleteSupplierAction } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.suppliers.metaTitle };
}

export default async function SuppliersPage() {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

  // P10.1 — capability flags for conditional UI rendering
  const canCreate = hasCapability(membership.role, "suppliers.create");
  const canEdit = hasCapability(membership.role, "suppliers.edit");
  const canDelete = hasCapability(membership.role, "suppliers.delete");
  const orgPlan = membership.organization.plan as "FREE" | "PRO" | "BUSINESS";

  const suppliers = await db.supplier.findMany({
    where: { organizationId: membership.organizationId },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-6">
      <AdvancedFeatureBanner labels={t.advancedFeature} plan={orgPlan} />

      <PageHeader
        title={t.suppliers.heading}
        description={t.suppliers.subtitle}
        actions={
          canCreate ? (
            <Button asChild>
              <Link href="/suppliers/new">
                <Plus className="h-4 w-4" />
                {t.suppliers.newSupplier}
              </Link>
            </Button>
          ) : undefined
        }
      />

      {suppliers.length === 0 ? (
        <EmptyState
          icon={Truck}
          title={t.suppliers.emptyTitle}
          description={t.suppliers.emptyBody}
          actions={
            canCreate
              ? [
                  {
                    label: t.suppliers.emptyCta,
                    href: "/suppliers/new",
                    icon: Plus,
                  },
                ]
              : undefined
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ResponsiveTable
              cardView={suppliers.map((s) => (
                <MobileCard
                  key={s.id}
                  href={`/suppliers/${s.id}`}
                  title={s.name}
                  subtitle={s.code ?? undefined}
                  badge={
                    s.isActive ? (
                      <Badge variant="success">{t.suppliers.activeLabel}</Badge>
                    ) : (
                      <Badge variant="secondary">{t.suppliers.inactiveLabel}</Badge>
                    )
                  }
                  fields={[
                    {
                      label: t.suppliers.columnCountry,
                      value: s.country ?? t.common.none,
                    },
                    {
                      label: t.suppliers.columnContact,
                      value: s.contactName ?? s.email ?? t.common.none,
                    },
                  ]}
                  actions={
                    <>
                      {canEdit ? (
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/suppliers/${s.id}/edit`}>{t.common.edit}</Link>
                        </Button>
                      ) : null}
                      {canDelete ? (
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
                      ) : null}
                    </>
                  }
                />
              ))}
            >
              <div className="overflow-x-auto">
                <Table className="min-w-[560px]">
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
                      <TableRow key={s.id} className="hover:bg-muted/50 transition-colors">
                        <TableCell className="font-medium">
                          <Link href={`/suppliers/${s.id}`} className="hover:underline">
                            {s.name}
                          </Link>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {s.code ?? t.common.none}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {s.contactName ?? s.email ?? t.common.none}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {s.country ?? t.common.none}
                        </TableCell>
                        <TableCell>
                          {s.isActive ? (
                            <Badge variant="success">{t.suppliers.activeLabel}</Badge>
                          ) : (
                            <Badge variant="secondary">{t.suppliers.inactiveLabel}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {canEdit ? (
                              <Button variant="ghost" size="sm" asChild>
                                <Link href={`/suppliers/${s.id}/edit`}>{t.common.edit}</Link>
                              </Button>
                            ) : null}
                            {canDelete ? (
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
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </ResponsiveTable>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
