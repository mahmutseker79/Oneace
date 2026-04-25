import { Plus, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

import { AssignmentDeleteButton } from "./assignment-delete-button";

export const metadata: Metadata = {
  title: "Assignments",
};

/**
 * Count assignments page. Shows all users assigned to this count with their roles.
 */
export default async function CountAssignmentsPage({
  params,
}: {
  params: { id: string };
}) {
  const { membership } = await requireActiveMembership();
  const orgId = membership.organizationId;

  const canCreate = hasCapability(membership.role, "countAssignments.create");
  const canRemove = hasCapability(membership.role, "countAssignments.remove");

  // Fetch count
  const count = await db.stockCount.findFirst({
    where: { id: params.id, organizationId: orgId },
    select: { id: true, name: true, state: true },
  });

  if (!count) {
    notFound();
  }

  // Fetch assignments
  const assignments = await db.countAssignment.findMany({
    where: { countId: params.id },
    include: {
      user: { select: { id: true, email: true, name: true } },
      department: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <Link
        href={`/stock-counts/${params.id}`}
        className="text-muted-foreground hover:underline self-start text-sm"
      >
        {count.name}
      </Link>
      <PageHeader
        title="Assignments"
        description="Manage counters for this count"
        actions={
          canCreate ? (
            <Link href={`/stock-counts/${params.id}/assignments/new`}>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Assign Counter
              </Button>
            </Link>
          ) : undefined
        }
      />

      {assignments.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No assignments yet"
          description="Assign team members to participate in or approve this count."
        />
      ) : (
        <div className="grid gap-4">
          {assignments.map((assignment) => (
            <Card key={assignment.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      {assignment.user.name || assignment.user.email}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">{assignment.user.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge>{assignment.role}</Badge>
                    <Badge variant="outline">{assignment.status}</Badge>
                    {canRemove && <AssignmentDeleteButton id={assignment.id} />}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-1">
                {assignment.department && <p>Department: {assignment.department.name}</p>}
                <p>Items Counted: {assignment.itemsCounted}</p>
                {assignment.startedAt && (
                  <p>Started: {new Date(assignment.startedAt).toLocaleString()}</p>
                )}
                {assignment.completedAt && (
                  <p>Completed: {new Date(assignment.completedAt).toLocaleString()}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
