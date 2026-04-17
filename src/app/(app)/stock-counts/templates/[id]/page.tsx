import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";

import { Button } from "@/components/ui/button";
import { TemplateForm } from "../template-form";

/**
 * Edit count template page.
 */
export default async function EditTemplatePage({
  params,
}: {
  params: { id: string };
}) {
  const { membership } = await requireActiveMembership();
  const orgId = membership.organizationId;

  const canEdit = hasCapability(membership.role, "countTemplates.edit");

  // Fetch template
  const template = await db.countTemplate.findFirst({
    where: { id: params.id, organizationId: orgId },
  });

  if (!template) {
    notFound();
  }

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
      <div>
        <h1 className="text-3xl font-bold">{template.name}</h1>
        <p className="text-muted-foreground">Edit count template</p>
      </div>

      {canEdit ? (
        <div className="max-w-2xl">
          <TemplateForm
            template={{
              ...template,
              itemIds: template.categoryIds,
              requiresApproval: false,
            }}
            items={items}
            departments={departments}
            warehouses={warehouses}
            isNew={false}
          />

          <div className="mt-4">
            <Link href="/stock-counts/templates">
              <Button variant="outline">Back</Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-warning/20 bg-warning-light p-4 text-sm">
          <p>You don&apos;t have permission to edit this template.</p>
        </div>
      )}
    </div>
  );
}
