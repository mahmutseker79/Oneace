import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { requireActiveMembership } from "@/lib/session";

import { AddLineForm } from "./add-line-form";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params: _params }: PageProps): Promise<Metadata> {
  return { title: "Add Transfer Line" };
}

export default async function AddLinePage({ params }: PageProps) {
  const { id } = await params;
  const { membership } = await requireActiveMembership();

  // Verify transfer exists and is DRAFT
  const transfer = await db.stockTransfer.findFirst({
    where: { id, organizationId: membership.organizationId },
    select: { id: true, status: true, transferNumber: true },
  });

  if (!transfer) {
    notFound();
  }

  if (transfer.status !== "DRAFT") {
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
              You can only add lines to a transfer that is in DRAFT status.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Load all items for selection
  const items = await db.item.findMany({
    where: { organizationId: membership.organizationId },
    select: { id: true, sku: true, name: true },
    orderBy: { name: "asc" },
    take: 1000,
  });

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
          <CardTitle>Add Item to {transfer.transferNumber}</CardTitle>
        </CardHeader>
        <CardContent>
          <AddLineForm transferId={id} items={items} />
        </CardContent>
      </Card>
    </div>
  );
}
