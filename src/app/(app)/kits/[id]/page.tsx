import { Package } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DeleteButton } from "@/components/shell/delete-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { getMessages } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";

import { removeKitComponentAction } from "../actions";
import { AddComponentDialog } from "./add-component-dialog";
import { AssembleDisassemblePanel } from "./assemble-panel";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const kit = await db.kit.findUnique({
    where: { id },
    select: { name: true },
  });
  return { title: kit ? `${kit.name} — Kits` : "Kit Detail" };
}

export default async function KitDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

  const canEdit = hasCapability(membership.role, "kits.edit");
  const canAssemble = hasCapability(membership.role, "kits.assemble");
  const canDisassemble = hasCapability(membership.role, "kits.disassemble");

  const kit = await db.kit.findFirst({
    where: { id, organizationId: membership.organizationId },
    include: {
      parentItem: {
        select: { id: true, name: true, sku: true },
      },
      components: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!kit) {
    notFound();
  }

  // Fetch component item details separately since KitComponent doesn't have a direct relation
  const componentItemIds = kit.components.map((c) => c.componentItemId);
  const componentItems =
    componentItemIds.length > 0
      ? await db.item.findMany({
          where: { id: { in: componentItemIds } },
          select: { id: true, name: true, sku: true, unit: true },
        })
      : [];
  const itemMap = new Map(componentItems.map((i) => [i.id, i]));

  // Fetch variant details if any
  const variantIds = kit.components.map((c) => c.variantId).filter((v): v is string => v !== null);
  const variants =
    variantIds.length > 0
      ? await db.itemVariant.findMany({
          where: { id: { in: variantIds } },
          select: { id: true, name: true },
        })
      : [];
  const variantMap = new Map(variants.map((v) => [v.id, v]));

  // Fetch warehouses for assemble/disassemble
  const warehouses = await db.warehouse.findMany({
    where: { organizationId: membership.organizationId, isArchived: false },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });

  // Fetch items for add component dialog
  const items = canEdit
    ? await db.item.findMany({
        where: {
          organizationId: membership.organizationId,
          status: "ACTIVE",
          id: { not: kit.parentItemId },
        },
        select: { id: true, name: true, sku: true },
        orderBy: { name: "asc" },
        take: 500,
      })
    : [];

  const componentCount = kit.components.length;

  const typeBadgeVariant = (type: string) => {
    switch (type) {
      case "KIT":
        return "info" as const;
      case "BUNDLE":
        return "warning" as const;
      case "ASSEMBLY":
        return "success" as const;
      default:
        return "secondary" as const;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={kit.name}
        description={kit.description || `${kit.type} with ${componentCount} component(s)`}
        breadcrumb={[
          { label: t.kits?.heading ?? "Kits & Bundles", href: "/kits" },
          { label: kit.name, href: "#" },
        ]}
        backHref="/kits"
      />

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Type
            </p>
            <div className="mt-1">
              <Badge variant={typeBadgeVariant(kit.type)}>{kit.type}</Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Parent Item
            </p>
            <Link
              href={`/items/${kit.parentItem.id}`}
              className="mt-1 block text-sm font-semibold text-primary hover:underline"
            >
              {kit.parentItem.sku} — {kit.parentItem.name}
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Components
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{componentCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Status
            </p>
            <div className="mt-1">
              <Badge variant={kit.isActive ? "success" : "secondary"}>
                {kit.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Components table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Components</CardTitle>
            <CardDescription>Items that make up this {kit.type.toLowerCase()}</CardDescription>
          </div>
          {canEdit && <AddComponentDialog kitId={kit.id} items={items} />}
        </CardHeader>
        <CardContent>
          {componentCount === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">No components added yet.</p>
              {canEdit && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Add items to this kit using the button above.
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Item Name</TableHead>
                    <TableHead>Variant</TableHead>
                    <TableHead className="text-center">Qty per Kit</TableHead>
                    <TableHead>Unit</TableHead>
                    {canEdit && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kit.components.map((comp) => {
                    const item = itemMap.get(comp.componentItemId);
                    const variant = comp.variantId ? variantMap.get(comp.variantId) : null;

                    return (
                      <TableRow key={comp.id}>
                        <TableCell className="font-mono text-xs">
                          {item ? (
                            <Link
                              href={`/items/${item.id}`}
                              className="text-primary hover:underline"
                            >
                              {item.sku}
                            </Link>
                          ) : (
                            comp.componentItemId
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{item?.name ?? "Unknown"}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {variant?.name ?? "—"}
                        </TableCell>
                        <TableCell className="text-center tabular-nums font-semibold">
                          {Number(comp.quantity)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{item?.unit ?? "—"}</TableCell>
                        {canEdit && (
                          <TableCell className="text-right">
                            <DeleteButton
                              labels={{
                                trigger: "Remove",
                                title: "Remove component",
                                body: `Remove ${item?.name ?? "this component"} from this kit?`,
                                cancel: "Cancel",
                                confirm: "Remove",
                              }}
                              action={removeKitComponentAction.bind(null, comp.id)}
                              iconOnly
                            />
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assemble / Disassemble panel */}
      {(canAssemble || canDisassemble) && componentCount > 0 && (
        <AssembleDisassemblePanel
          kitId={kit.id}
          kitName={kit.name}
          warehouses={warehouses}
          canAssemble={canAssemble}
          canDisassemble={canDisassemble}
        />
      )}
    </div>
  );
}
