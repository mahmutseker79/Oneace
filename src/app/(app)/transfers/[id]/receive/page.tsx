import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { requireActiveMembership } from "@/lib/session";

import { ReceiveForm } from "./receive-form";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return { title: "Receive Transfer" };
}

export default async function ReceivePage({ params }: PageProps) {
  const { id } = await params;
  const { membership } = await requireActiveMembership();

  // Verify transfer exists and is IN_TRANSIT
  const transfer = await db.stockTransfer.findFirst({
    where: { id, organizationId: membership.organizationId },
    select: {
      id: true,
      status: true,
      transferNumber: true,
      fromWarehouse: { select: { name: true } },
      toWarehouse: { select: { name: true } },
      lines: {
        include: {
          item: { select: { id: true, sku: true, name: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!transfer) {
    notFound();
  }

  if (transfer.status !== "IN_TRANSIT") {
    return (
      <div className="space-y-4">
        <Link href={`/transfers/${id}`}>
          <Button variant="ghost" size="sm">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>

        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
            <p className="text-sm text-orange-800">
              You can only receive transfers that are in IN_TRANSIT status.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link href={`/transfers/${id}`}>
        <Button variant="ghost" size="sm">
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back to Transfer
        </Button>
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Receive {transfer.transferNumber}</CardTitle>
          <p className="text-sm text-muted-foreground">
            From {transfer.fromWarehouse.name} to {transfer.toWarehouse.name}
          </p>
        </CardHeader>
        <CardContent>
          <ReceiveForm transferId={id} lines={transfer.lines} />
        </CardContent>
      </Card>
    </div>
  );
}
