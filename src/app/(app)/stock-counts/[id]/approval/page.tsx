import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ApprovalForm } from "./approval-form";

/**
 * Stock count approval page. Shows approval details and allows approve/reject.
 */
export async function generateMetadata({

}: {
  params: { id: string };
}): Promise<Metadata> {
  await getMessages();
  return { title: "Approval — Stock Counts" };
}

export default async function ApprovalPage({
  params,
}: {
  params: { id: string };
}) {
  const { membership } = await requireActiveMembership();
  const orgId = membership.organizationId;
  const t = await getMessages();

  const canApprove = hasCapability(membership.role, "stockCounts.approve");
  const canReject = hasCapability(membership.role, "stockCounts.reject");

  // Fetch count and approval
  const count = await db.stockCount.findFirst({
    where: { id: params.id, organizationId: orgId },
    include: {
      approval: {
        include: {
          requestedBy: { select: { id: true, email: true, name: true } },
          reviewedBy: { select: { id: true, email: true, name: true } },
        },
      },
      createdBy: { select: { id: true, email: true, name: true } },
    },
  });

  if (!count) {
    notFound();
  }

  const countLabel = count.name;

  if (!count.approval) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={"Approval"}
          description={"Review and approve this stock count"}
          backHref={`/stock-counts/${params.id}`}
          breadcrumb={[
            { label: t.nav?.counts ?? "Stock Counts", href: "/stock-counts" },
            { label: countLabel },
            { label: "Approval" },
          ]}
        />
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">No approval record found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={"Approval"}
        description={"Review and approve this stock count"}
        backHref={`/stock-counts/${params.id}`}
        breadcrumb={[
          { label: t.nav?.counts ?? "Stock Counts", href: "/stock-counts" },
          { label: countLabel },
          { label: "Approval" },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Count Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <p className="text-lg font-semibold">{count.state}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Created By</p>
                  <p className="text-lg font-semibold">
                    {count.createdBy?.name || count.createdBy?.email || "Unknown"}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Methodology</p>
                  <p className="text-lg font-semibold">{count.methodology}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Created At</p>
                  <p className="text-lg font-semibold">
                    {new Date(count.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {(canApprove || canReject) && count.state === "PENDING_APPROVAL" && (
            <div className="mt-6">
              <ApprovalForm countId={params.id} approval={count.approval} />
            </div>
          )}
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Approval Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Requested By</p>
                <p className="text-sm">
                  {count.approval.requestedBy.name || count.approval.requestedBy.email}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(count.approval.requestedAt).toLocaleString()}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <p className="text-sm font-semibold">{count.approval.status}</p>
              </div>

              {count.approval.reviewedBy && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Reviewed By</p>
                  <p className="text-sm">
                    {count.approval.reviewedBy.name || count.approval.reviewedBy.email}
                  </p>
                  {count.approval.reviewedAt && (
                    <p className="text-xs text-muted-foreground">
                      {new Date(count.approval.reviewedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              )}

              {count.approval.comment && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Comment</p>
                  <p className="text-sm">{count.approval.comment}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
