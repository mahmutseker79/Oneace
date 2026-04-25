import type { Metadata } from "next";
import Link from "next/link";

import { db } from "@/lib/db";
import { requireActiveMembership } from "@/lib/session";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { TemplateForm } from "../template-form";

export const metadata: Metadata = {
  title: "New Template",
};

/**
 * Create new count template page.
 */
export default async function NewTemplatePage() {
  const { membership } = await requireActiveMembership();
  const orgId = membership.organizationId;

  // Fetch dependencies
  const [items, departments, warehouses] = await Promise.all([
    db.item.findMany({
      where: { organizationId: orgId, status: "ACTIVE" },
      select: { id: true, sku: true, name: true },
      orderBy: { sku: "asc" },
    }),
    db.department.findMany({
      where: { organizationId: orgId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.warehouse.findMany({
      where: { organizationId: orgId, isArchived: false },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Count Template"
        description="Create a reusable count configuration"
      />

      <div className="max-w-2xl">
        <TemplateForm
          items={items}
          departments={departments}
          warehouses={warehouses}
          isNew={true}
        />

        <div className="mt-4">
          <Link href="/stock-counts/templates">
            <Button variant="outline">Cancel</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
