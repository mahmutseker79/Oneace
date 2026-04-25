import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";

import { CreateTransferForm } from "./create-transfer-form";

export async function generateMetadata(): Promise<Metadata> {
  const _t = await getMessages();
  return { title: "New Transfer" };
}

export default async function NewTransferPage() {
  const { membership } = await requireActiveMembership();
  const _t = await getMessages();

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

        <Card variant="warning">
          <CardContent className="pt-6">
            <p className="text-sm text-warning">
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
      <PageHeader
        title="New Transfer"
        description="Create an inter-warehouse transfer. You can add items after creating the transfer."
        backHref="/transfers"
      />
      <Card>
        <CardContent className="pt-6">
          <CreateTransferForm warehouses={warehouses} />
        </CardContent>
      </Card>
    </div>
  );
}
