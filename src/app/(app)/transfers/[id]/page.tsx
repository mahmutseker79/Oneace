import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Boxes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusTimeline } from "@/components/ui/status-timeline";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/lib/db";
import { getRegion } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";
import { canCancel, canReceive, canShip, isTerminal, statusLabel } from "@/lib/transfer/machine";
import Link from "next/link";

import { CancelTransferButton } from "./cancel-transfer-button";
import { ReceiveTransferButton } from "./receive-transfer-button";
import { RemoveLineButton } from "./remove-line-button";
import { ShipTransferButton } from "./ship-transfer-button";

type DetailPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: DetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const transfer = await db.stockTransfer.findUnique({
    where: { id },
    select: { transferNumber: true },
  });
  return {
    title: transfer ? transfer.transferNumber : "Transfer",
  };
}

function fmtDateOnly(value: Date | null | undefined, locale: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(value);
}

export default async function TransferDetailPage({ params }: DetailPageProps) {
  const { id } = await params;
  const { membership } = await requireActiveMembership();
  const region = await getRegion();

  const canCreate = hasCapability(membership.role, "transfers.create");
  const canShipTransfer = hasCapability(membership.role, "transfers.ship");
  const canReceiveTransfer = hasCapability(membership.role, "transfers.receive");
  const canCancelTransfer = hasCapability(membership.role, "transfers.cancel");

  const transfer = await db.stockTransfer.findFirst({
    where: { id, organizationId: membership.organizationId },
    include: {
      fromWarehouse: { select: { id: true, name: true, code: true } },
      toWarehouse: { select: { id: true, name: true, code: true } },
      lines: {
        include: {
          item: { select: { id: true, sku: true, name: true } },
        },
      },
    },
  });

  if (!transfer) {
    notFound();
  }

  const isReadOnly = isTerminal(transfer.status);
  const canAddLines = transfer.status === "DRAFT";
  const canRemoveLines = transfer.status === "DRAFT";

  return (
    <div className="space-y-6">
      <PageHeader
        title={transfer.transferNumber}
        backHref="/transfers"
        breadcrumb={[
          { label: "Transfers", href: "/transfers" },
          { label: transfer.transferNumber },
        ]}
      />
      <StatusTimeline
        steps={[
          {
            label: "Draft",
            completed: transfer.status !== "DRAFT",
            active: transfer.status === "DRAFT",
          },
          {
            label: "Shipped",
            completed: ["IN_TRANSIT", "RECEIVED"].includes(transfer.status),
            active: transfer.status === "SHIPPED",
          },
          {
            label: "In Transit",
            completed: transfer.status === "RECEIVED",
            active: transfer.status === "IN_TRANSIT",
          },
          { label: "Received", completed: transfer.status === "RECEIVED", active: false },
        ]}
        className="mb-2"
      />

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Status</p>
            <p className="text-lg font-semibold">{statusLabel(transfer.status)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Total Items</p>
            <p className="text-lg font-semibold">{transfer.lines.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Shipped Date</p>
            <p className="text-sm font-semibold">
              {fmtDateOnly(transfer.shippedAt, region.numberLocale)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Received Date</p>
            <p className="text-sm font-semibold">
              {fmtDateOnly(transfer.receivedAt, region.numberLocale)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Created</p>
            <p className="text-sm font-semibold">
              {fmtDateOnly(transfer.createdAt, region.numberLocale)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Lines Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Transfer Lines</CardTitle>
          {canAddLines && canCreate && (
            <Button asChild size="sm">
              <Link href={`/transfers/${id}/add-line`}>Add Item</Link>
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {transfer.lines.length === 0 ? (
            <EmptyState
              bare
              icon={Boxes}
              title="No lines added yet"
              description="Create the transfer first, then add items."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Shipped Qty</TableHead>
                  <TableHead className="text-right">Received Qty</TableHead>
                  <TableHead className="text-right">Discrepancy</TableHead>
                  {canRemoveLines && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfer.lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell>{line.item.name}</TableCell>
                    <TableCell className="font-mono text-sm">{line.item.sku}</TableCell>
                    <TableCell className="text-right font-semibold">{line.shippedQty}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {line.receivedQty || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {line.discrepancy !== 0 ? (
                        <span
                          className={line.discrepancy > 0 ? "text-success" : "text-destructive"}
                        >
                          {line.discrepancy > 0 ? "+" : ""}
                          {line.discrepancy}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    {canRemoveLines && (
                      <TableCell className="text-right">
                        <RemoveLineButton lineId={line.id} transferId={id} />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      {!isReadOnly && (
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {canShip(transfer.status) && canShipTransfer && <ShipTransferButton transferId={id} />}
            {canReceive(transfer.status) && canReceiveTransfer && (
              <ReceiveTransferButton transferId={id} />
            )}
            {canCancel(transfer.status) && canCancelTransfer && (
              <CancelTransferButton transferId={id} />
            )}
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {transfer.note && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{transfer.note}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
