import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";
import { canRollback } from "@/lib/stockcount/machine";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RollbackForm } from "./rollback-form";

/**
 * Rollback page. Allows rolling back a completed count.
 */
export default async function RollbackPage({
  params,
}: {
  params: { id: string };
}) {
  const { membership } = await requireActiveMembership();
  const orgId = membership.organizationId;

  const canRollbackCount = hasCapability(membership.role, "stockCounts.rollback");

  // Fetch count
  const count = await db.stockCount.findFirst({
    where: { id: params.id, organizationId: orgId },
    include: {
      createdBy: { select: { id: true, email: true, name: true } },
    },
  });

  if (!count) {
    notFound();
  }

  if (!canRollback(count.state as any)) {
    return (
      <div className="space-y-6">
        <Link href={`/stock-counts/${params.id}`} className="text-muted-foreground hover:underline">
          {count.name}
        </Link>
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              This count cannot be rolled back (current status: {count.state})
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/stock-counts/${params.id}`} className="text-muted-foreground hover:underline">
          {count.name}
        </Link>
        <h1 className="text-3xl font-bold">Rollback Count</h1>
        <p className="text-muted-foreground">Reverse this completed count and revert stock adjustments</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {canRollbackCount ? (
            <Card>
              <CardHeader>
                <CardTitle>Rollback Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm">
                  <p className="font-semibold text-red-900">Warning: This action cannot be undone</p>
                  <p className="text-red-800 mt-2">
                    Rolling back this count will revert all stock adjustments made during reconciliation.
                  </p>
                </div>

                <RollbackForm countId={params.id} />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  You don't have permission to rollback counts
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Count Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="font-medium text-muted-foreground">Name</p>
                <p>{count.name}</p>
              </div>
              <div>
                <p className="font-medium text-muted-foreground">Status</p>
                <p>{count.state}</p>
              </div>
              <div>
                <p className="font-medium text-muted-foreground">Created By</p>
                <p>{count.createdBy?.name || count.createdBy?.email || "Unknown"}</p>
              </div>
              <div>
                <p className="font-medium text-muted-foreground">Created At</p>
                <p>{new Date(count.createdAt).toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
