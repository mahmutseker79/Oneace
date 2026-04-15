import { Plus } from "lucide-react";
import Link from "next/link";

import { db } from "@/lib/db";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Count templates listing page.
 */
export default async function TemplatesPage() {
  const { membership } = await requireActiveMembership();
  const orgId = membership.organizationId;

  const canCreate = hasCapability(membership.role, "countTemplates.create");

  // Fetch templates
  const templates = await db.countTemplate.findMany({
    where: { organizationId: orgId },
    include: {
      department: { select: { id: true, name: true } },
      warehouse: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Count Templates</h1>
          <p className="text-muted-foreground">Reusable count configurations</p>
        </div>
        {canCreate && (
          <Link href="/stock-counts/templates/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Template
            </Button>
          </Link>
        )}
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">No templates yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {templates.map((template) => (
            <Link key={template.id} href={`/stock-counts/templates/${template.id}`}>
              <Card className="hover:bg-muted/50 cursor-pointer transition-colors">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      {template.description && (
                        <p className="text-sm text-muted-foreground">{template.description}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Badge>{template.scope}</Badge>
                      <Badge variant="outline">{template.methodology}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-1">
                  <p>Items: {template.categoryIds.length}</p>
                  {template.department && <p>Department: {template.department.name}</p>}
                  {template.warehouse && <p>Warehouse: {template.warehouse.name}</p>}
                  {template.cronExpression && <p>Schedule: {template.cronExpression}</p>}
                  
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
