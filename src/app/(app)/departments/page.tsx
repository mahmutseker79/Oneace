import { Plus } from "lucide-react";
import Link from "next/link";

import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Departments</h1>
          <p className="text-sm text-muted-foreground">Organize your team and inventory</p>
        </div>
        {canCreate && (
          <Link href="/departments/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Department
            </Button>
          </Link>
        )}
      </div>

      {departments.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">No departments yet</p>
          </CardContent>
        </Card>
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
                      <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
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
