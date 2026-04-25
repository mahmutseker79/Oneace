import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { requireActiveMembership } from "@/lib/session";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { AssignmentForm } from "../assignment-form";

export const metadata: Metadata = {
  title: "New Assignment",
};

/**
 * Create new assignment page.
 */
export default async function NewAssignmentPage({
  params,
}: {
  params: { id: string };
}) {
  const { membership } = await requireActiveMembership();
  const orgId = membership.organizationId;

  // Verify count exists
  const count = await db.stockCount.findFirst({
    where: { id: params.id, organizationId: orgId },
    select: { id: true, name: true },
  });

  if (!count) {
    notFound();
  }

  // Fetch members, departments, and warehouses
  const [members, departments, warehouses] = await Promise.all([
    db.user.findMany({
      where: { memberships: { some: { organizationId: orgId } } },
      select: { id: true, email: true, name: true },
      orderBy: { email: "asc" },
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
      <Link
        href={`/stock-counts/${params.id}/assignments`}
        className="text-muted-foreground hover:underline self-start text-sm"
      >
        Assignments for {count.name}
      </Link>
      <PageHeader title="Assign Counter" description="Assign a user to this count" />

      <div className="max-w-2xl">
        <AssignmentForm
          countId={params.id}
          members={members}
          departments={departments}
          warehouses={warehouses}
          isNew={true}
        />

        <div className="mt-4">
          <Link href={`/stock-counts/${params.id}/assignments`}>
            <Button variant="outline">Cancel</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
