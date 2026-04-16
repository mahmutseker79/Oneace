import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";
import { canRollback } from "@/lib/stockcount/machine";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { RollbackForm } from "./rollback-form";

/**
 * Rollback page. Allows rolling back a completed count.
 */
export async function generateMetadata({

}: {
  params: { id: string };
}): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.stockCounts.rollback?.metaTitle || "Rollback" };
}

export default async function RollbackPage({
  params,
}: {
  params: { id: string };
}) {
  const { membership } = await requireActiveMembership();
  const orgId = membership.organizationId;
  const t = await getMessages();

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

  const countLabel = count.name;

  if (!canRollback(count.state as typeof count.state)) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t.stockCounts.rollback?.heading || "Rollback Count"}
          description={
            t.stockCounts.rollback?.subtitle ||
            "Reverse this completed count and revert stock adjustments"
          }
          backHref={`/stock-counts/${params.id}`}
          breadcrumb={[
            { label: t.nav?.stockCounts ?? "Stock Counts", href: "/stock-counts" },
            { label: countLabel },
            { label: t.stockCounts.rollback?.heading || "Rollback Count" },
          ]}
        />
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
      <PageHeader
        title={t.stockCounts.rollback?.heading || "Rollback Count"}
        description={
          t.stockCounts.rollback?.subtitle ||
          "Reverse this completed count and revert stock adjustments"
        }
        backHref={`/stock-counts/${params.id}`}
        breadcrumb={[
          { label: t.nav?.stockCounts ?? "Stock Counts", href: "/stock-counts" },
          { label: countLabel },
          { label: t.stockCounts.rollback?.heading || "Rollback Count" },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {canRollbackCount ? (
            <Card>
              <CardHeader>
                <CardTitle>Rollback Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-lg border border-destructive/20 bg-destructive-light p-4 text-sm">
                  <p className="font-semibold text-destructive">
                    Warning: This action cannot be undone
                  </p>
                  <p className="text-destructive mt-2">
                    Rolling back this count will revert all stock adjustments made during
                    reconciliation.
                  </p>
                </div>

                <RollbackForm countId={params.id} />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  You don&apos;t have permission to rollback counts
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
