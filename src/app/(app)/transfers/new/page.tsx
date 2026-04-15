import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";

import { CreateTransferForm } from "./create-transfer-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: "New Transfer" };
}

export default async function NewTransferPage() {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

  // Load all warehouses for the org
  const warehouses = await db.warehouse.findMany({
    where: { organizationId: membership.organizationId },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });

  if (warehouses.length < 2) {
    return (
      <div className="space-y-4">
        <Link href="/transfers">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>

        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
            <p className="text-sm text-orange-800">
              You need at least two warehouses to create a transfer. Please add another warehouse
              before proceeding.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link href="/transfers">
        <Button variant="ghost" size="sm">
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back to Transfers
        </Button>
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>New Transfer</CardTitle>
          <CardDescription>
            Create an inter-warehouse transfer. You can add items after creating the transfer.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateTransferForm warehouses={warehouses} />
        </CardContent>
      </Card>
    </div>
  );
}
