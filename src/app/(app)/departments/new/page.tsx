import type { Metadata } from "next";
import Link from "next/link";

import { db } from "@/lib/db";
import { requireActiveMembership } from "@/lib/session";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { DepartmentForm } from "../department-form";

export const metadata: Metadata = {
  title: "New Department",
};

/**
 * Create new department page.
 */
export default async function NewDepartmentPage() {
  const { membership } = await requireActiveMembership();
  const orgId = membership.organizationId;

  // Fetch managers (users in org) and warehouses for form
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
      <PageHeader title="New Department" description="Create a new department" />

      <div className="max-w-2xl">
        <DepartmentForm members={members} warehouses={warehouses} isNew={true} />

        <div className="mt-4">
          <Link href="/departments">
            <Button variant="outline">Cancel</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
