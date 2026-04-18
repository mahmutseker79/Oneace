import { ArrowLeftRight, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { WrapperTabs } from "@/components/shell/wrapper-tabs";
import { LOCATIONS_TAB_SPECS, resolveWrapperTabs } from "@/components/shell/wrapper-tabs-config";
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
import { getMessages, getRegion } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";
import { statusBadgeVariant, statusLabel } from "@/lib/transfer/machine";

export async function generateMetadata(): Promise<Metadata> {
  const _t = await getMessages();
  return { title: "Stock Transfers" };
}

function fmtDate(value: Date | null | undefined, locale: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(value);
}

export default async function TransfersPage() {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();
  const region = await getRegion();

  const canCreate = hasCapability(membership.role, "transfers.create");

  // Load all transfers for this org, sorted by creation date (newest first)
  const transfers = await db.stockTransfer.findMany({
    where: { organizationId: membership.organizationId },
    include: {
      fromWarehouse: { select: { id: true, name: true } },
      toWarehouse: { select: { id: true, name: true } },
      lines: { select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  if (transfers.length === 0) {
    return (
      <div className="space-y-6">
        <WrapperTabs
          tabs={resolveWrapperTabs(LOCATIONS_TAB_SPECS, t)}
          ariaLabel="Locations sections"
        />
        <PageHeader
          title="Stock Transfers"
          description="Manage inter-warehouse transfers"
          actions={
            canCreate ? (
              <Button asChild>
                <Link href="/transfers/new">
                  <Plus className="mr-2 h-4 w-4" />
                  New Transfer
                </Link>
              </Button>
            ) : undefined
          }
        />

        <EmptyState
          icon={ArrowLeftRight}
          title="No transfers yet"
          description="Create your first inter-warehouse transfer to move stock between locations"
          actions={
            canCreate
              ? [
                  {
                    label: "Create Transfer",
                    href: "/transfers/new",
                    icon: Plus,
                  },
                ]
              : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <WrapperTabs
        tabs={resolveWrapperTabs(LOCATIONS_TAB_SPECS, t)}
        ariaLabel="Locations sections"
      />
      <PageHeader
        title="Stock Transfers"
        description={`${transfers.length} transfer${transfers.length !== 1 ? "s" : ""}`}
        actions={
          canCreate ? (
            <Button asChild>
              <Link href="/transfers/new">
                <Plus className="mr-2 h-4 w-4" />
                New Transfer
              </Link>
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardContent className="p-0">
          <ResponsiveTable
            cardView={transfers.map((transfer) => (
              <MobileCard
                key={transfer.id}
                href={`/transfers/${transfer.id}`}
                title={transfer.transferNumber}
                badge={
                  <Badge
                    variant={
                      statusBadgeVariant(transfer.status) as
                        | "default"
                        | "secondary"
                        | "destructive"
                        | "outline"
                    }
                  >
                    {statusLabel(transfer.status)}
                  </Badge>
                }
                fields={[
                  {
                    label: "From",
                    value: transfer.fromWarehouse.name,
                  },
                  {
                    label: "To",
                    value: transfer.toWarehouse.name,
                  },
                  {
                    label: "Date",
                    value: fmtDate(transfer.createdAt, region.numberLocale),
                  },
                  {
                    label: "Items",
                    value: transfer.lines.length,
                  },
                ]}
              />
            ))}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Transfer #</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead>Shipped</TableHead>
                  <TableHead>Received</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map((transfer) => (
                  <TableRow key={transfer.id}>
                    <TableCell>
                      <Link
                        href={`/transfers/${transfer.id}`}
                        className="font-mono font-semibold hover:underline"
                      >
                        {transfer.transferNumber}
                      </Link>
                    </TableCell>
                    <TableCell>{transfer.fromWarehouse.name}</TableCell>
                    <TableCell>{transfer.toWarehouse.name}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          statusBadgeVariant(transfer.status) as
                            | "default"
                            | "secondary"
                            | "destructive"
                            | "outline"
                        }
                      >
                        {statusLabel(transfer.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{transfer.lines.length}</TableCell>
                    <TableCell>{fmtDate(transfer.shippedAt, region.numberLocale)}</TableCell>
                    <TableCell>{fmtDate(transfer.receivedAt, region.numberLocale)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ResponsiveTable>
        </CardContent>
      </Card>
    </div>
  );
}
