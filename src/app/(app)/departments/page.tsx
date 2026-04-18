import { Building2, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = {
  title: "Departments",
};

/**
 * Department listing page. Shows all departments in the org with options
 * to create, edit, or delete.
 */
export default async function DepartmentsPage() {
  const { membership } = await requireActiveMembership();
  const _t = await getMessages();

  const canCreate = hasCapability(membership.role, "departments.create");

  // Fetch all departments for this org
  const departments = await db.department.findMany({
    where: { organizationId: membership.organizationId },
    include: {
      manager: { select: { id: true, email: true, name: true } },
      warehouse: { select: { id: true, name: true, code: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Departments"
        description="Organize your team and inventory"
        actions={
          canCreate ? (
            <Link href="/departments/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Department
              </Button>
            </Link>
          ) : undefined
        }
      />

      {departments.length === 0 ? (
        // P3-2 (audit v1.0 §9.2) — standardize the empty state so
        // the first-run experience matches the rest of the product
        // instead of a bare "No departments yet" banner.
        <EmptyState
          icon={Building2}
          title="No departments yet"
          description="Group your team and inventory by department to slice reports and restrict stock access."
          actions={
            canCreate ? [{ label: "New Department", href: "/departments/new", icon: Plus }] : []
          }
        />
      ) : (
        <div className="grid gap-4">
          {departments.map((dept) => (
            <Link key={dept.id} href={`/departments/${dept.id}`}>
              <Card className="hover:bg-muted/50 cursor-pointer transition-colors">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {dept.color && (
                        <div className="h-8 w-8 rounded" style={{ backgroundColor: dept.color }} />
                      )}
                      <div>
                        <CardTitle className="text-lg">{dept.name}</CardTitle>
                        {dept.code && (
                          <p className="text-sm text-muted-foreground">Code: {dept.code}</p>
                        )}
                      </div>
                    </div>
                    {!dept.isActive && (
                      <span className="text-xs bg-destructive-light text-destructive px-2 py-1 rounded">
                        Inactive
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {dept.manager && <p>Manager: {dept.manager.name || dept.manager.email}</p>}
                  {dept.warehouse && <p>Warehouse: {dept.warehouse.name}</p>}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
