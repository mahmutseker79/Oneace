import { Plus, ArrowLeftRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/lib/db";
import { format, getMessages, getRegion } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";
import { statusBadgeVariant, statusLabel } from "@/lib/transfer/machine";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
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
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Stock Transfers</h1>
            <p className="text-sm text-muted-foreground">
              Manage inter-warehouse transfers
            </p>
          </div>
          {canCreate && (
            <Button asChild>
              <Link href="/transfers/new">
                <Plus className="mr-2 h-4 w-4" />
                New Transfer
              </Link>
            </Button>
          )}
        </div>

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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Stock Transfers</h1>
          <p className="text-sm text-muted-foreground">
            {transfers.length} transfer{transfers.length !== 1 ? "s" : ""}
          </p>
        </div>
        {canCreate && (
          <Button asChild>
            <Link href="/transfers/new">
              <Plus className="mr-2 h-4 w-4" />
              New Transfer
            </Link>
          </Button>
        )}
      </div>

      <>
        {/* Phase 7B: Desktop table */}
        <div className="hidden md:block">
          <Card>
            <CardContent className="pt-6">
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
                        <Badge variant={statusBadgeVariant(transfer.status) as any}>
                          {statusLabel(transfer.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{transfer.lines.length}</TableCell>
                      <TableCell>{fmtDate(transfer.shippedAt, region)}</TableCell>
                      <TableCell>{fmtDate(transfer.receivedAt, region)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Phase 7B: Mobile card view */}
        <div className="space-y-3 md:hidden">
          {transfers.map((transfer) => (
            <Card key={transfer.id} className="p-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/transfers/${transfer.id}`}
                    className="text-base font-semibold font-mono hover:underline"
                  >
                    {transfer.transferNumber}
                  </Link>
                  <Badge variant={statusBadgeVariant(transfer.status) as any}>
                    {statusLabel(transfer.status)}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">From</p>
                    <p className="font-medium">{transfer.fromWarehouse.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">To</p>
                    <p className="font-medium">{transfer.toWarehouse.name}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm text-muted-foreground">
                  <div>
                    <p className="text-xs">Items</p>
                    <p className="font-medium text-foreground">{transfer.lines.length}</p>
                  </div>
                  <div>
                    <p className="text-xs">Shipped</p>
                    <p className="font-medium text-foreground">{fmtDate(transfer.shippedAt, region)}</p>
                  </div>
                  <div>
                    <p className="text-xs">Received</p>
                    <p className="font-medium text-foreground">{fmtDate(transfer.receivedAt, region)}</p>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </>
    </div>
  );
}
