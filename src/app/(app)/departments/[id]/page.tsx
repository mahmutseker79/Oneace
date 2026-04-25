import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { DepartmentForm } from "../department-form";

export const metadata: Metadata = {
  title: "Department",
};

/**
 * Edit department page.
 */
export default async function EditDepartmentPage({
  params,
}: {
  params: { id: string };
}) {
  const { membership } = await requireActiveMembership();
  const orgId = membership.organizationId;

  const canEdit = hasCapability(membership.role, "departments.edit");

  // Fetch department
  const department = await db.department.findFirst({
    where: { id: params.id, organizationId: orgId },
    include: {
      manager: { select: { id: true, email: true, name: true } },
      warehouse: { select: { id: true, name: true, code: true } },
    },
  });

  if (!department) {
    notFound();
  }

  // Fetch managers and warehouses for form
  const [members, warehouses] = await Promise.all([
    db.user.findMany({
      where: { memberships: { some: { organizationId: orgId } } },
      select: { id: true, email: true, name: true },
      orderBy: { email: "asc" },
    }),
    db.warehouse.findMany({
      where: { organizationId: orgId, isArchived: false },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title={department.name} description="Manage department settings" />

      {canEdit ? (
        <div className="max-w-2xl">
          <DepartmentForm
            department={department}
            members={members}
            warehouses={warehouses}
            isNew={false}
          />

          <div className="mt-4">
            <Link href="/departments">
              <Button variant="outline">Back</Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-warning bg-warning-light p-4 text-sm">
          <p>You don&apos;t have permission to edit this department.</p>
        </div>
      )}
    </div>
  );
}
