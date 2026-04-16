import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";

import { StatusChangeForm } from "./status-change-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: "Change Stock Status" };
}

export default async function StatusChangePage() {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  // Fetch data for dropdowns
  const [items, warehouses, reasonCodes] = await Promise.all([
    db.item.findMany({
      where: { organizationId: membership.organizationId, status: "ACTIVE" },
      orderBy: { name: "asc" },
      take: 500,
      select: { id: true, sku: true, name: true },
    }),
    db.warehouse.findMany({
      where: { organizationId: membership.organizationId, isArchived: false },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: { id: true, name: true, code: true },
    }),
    db.reasonCode.findMany({
      where: { organizationId: membership.organizationId, isActive: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: { id: true, code: true, name: true, category: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/inventory">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">Change Stock Status</h1>
          <p className="text-muted-foreground">Move stock between different status categories</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Status Change Details</CardTitle>
        </CardHeader>
        <CardContent>
          <StatusChangeForm
            items={items.map((item) => ({
              id: item.id,
              label: `${item.sku} - ${item.name}`,
            }))}
            warehouses={warehouses.map((warehouse) => ({
              id: warehouse.id,
              label: `${warehouse.name} (${warehouse.code})`,
            }))}
            reasonCodes={reasonCodes.map((code) => ({
              id: code.id,
              label: `${code.code} - ${code.name}`,
              category: code.category,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
