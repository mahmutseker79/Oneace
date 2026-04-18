import { Package, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { WrapperTabs } from "@/components/shell/wrapper-tabs";
import { INVENTORY_TAB_SPECS, resolveWrapperTabs } from "@/components/shell/wrapper-tabs-config";
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

type KitType = "KIT" | "BUNDLE" | "ASSEMBLY";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Kits & Bundles — OneAce" };
}

export default async function KitsPage() {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

  // P10.1 — capability flag for conditional UI rendering
  const canCreate = hasCapability(membership.role, "kits.create");

  const kits = await db.kit.findMany({
    where: { organizationId: membership.organizationId, isActive: true },
    include: {
      parentItem: { select: { id: true, name: true, sku: true } },
      _count: { select: { components: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  function typeBadge(type: KitType) {
    if (type === "KIT") return <Badge variant="default">{type}</Badge>;
    if (type === "BUNDLE") return <Badge variant="info">{type}</Badge>;
    return <Badge variant="secondary">{type}</Badge>;
  }

  return (
    <div className="space-y-6">
      <WrapperTabs
        tabs={resolveWrapperTabs(INVENTORY_TAB_SPECS, t)}
        ariaLabel="Inventory sections"
      />
      <PageHeader
        title="Kits & Bundles"
        description="Manage kit and bundle definitions"
        actions={
          canCreate ? (
            <Button asChild>
              <Link href="/kits/new">
                <Plus className="h-4 w-4" />
                Create Kit
              </Link>
            </Button>
          ) : null
        }
      />

      {kits.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No kits created yet"
          description="Kits and bundles help you group items together for faster ordering."
          actions={
            canCreate
              ? [
                  {
                    label: "Create a kit",
                    href: "/kits/new",
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
              cardView={kits.map((kit) => (
                <MobileCard
                  key={kit.id}
                  title={kit.name}
                  subtitle={kit.parentItem.sku}
                  badge={typeBadge(kit.type as KitType)}
                  href={`/kits/${kit.id}`}
                  fields={[
                    { label: "Parent Item", value: kit.parentItem.name },
                    { label: "Components", value: kit._count.components },
                    { label: "Status", value: "Active" },
                  ]}
                />
              ))}
            >
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Parent Item</TableHead>
                    <TableHead>Kit Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Components</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kits.map((kit) => (
                    <TableRow key={kit.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="font-mono text-xs">
                        <div className="font-medium text-foreground">{kit.parentItem.name}</div>
                        <div className="text-muted-foreground">{kit.parentItem.sku}</div>
                      </TableCell>
                      <TableCell>
                        <Link href={`/kits/${kit.id}`} className="font-medium hover:underline">
                          {kit.name}
                        </Link>
                      </TableCell>
                      <TableCell>{typeBadge(kit.type as KitType)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {kit._count.components}
                      </TableCell>
                      <TableCell>
                        <Badge variant="success">Active</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/kits/${kit.id}`}>View</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ResponsiveTable>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
