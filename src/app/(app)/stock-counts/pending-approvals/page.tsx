import Link from "next/link";

import { db } from "@/lib/db";
import { requireActiveMembership } from "@/lib/session";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Pending approvals page. Shows all counts awaiting approval across the org.
 */
export default async function PendingApprovalsPage() {
  const { membership } = await requireActiveMembership();
  const orgId = membership.organizationId;

  // Fetch pending approvals
  const approvals = await db.countApproval.findMany({
    where: {
      organizationId: orgId,
      status: "PENDING",
    },
    include: {
      count: {
        select: {
          id: true,
          name: true,
          methodology: true,
          createdAt: true,
          createdBy: { select: { id: true, email: true, name: true } },
        },
      },
      requestedBy: { select: { id: true, email: true, name: true } },
    },
    orderBy: { requestedAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Pending Approvals</h1>
        <p className="text-muted-foreground">Counts awaiting your approval</p>
      </div>

      {approvals.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">No pending approvals</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {approvals.map((approval) => (
            <Link
              key={approval.id}
              href={`/stock-counts/${approval.count.id}/approval`}
            >
              <Card className="hover:bg-muted/50 cursor-pointer transition-colors">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{approval.count.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {approval.count.createdBy?.name || approval.count.createdBy?.email}
                      </p>
                    </div>
                    <Badge>{approval.count.methodology}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-1">
                  <p>Requested: {new Date(approval.requestedAt).toLocaleString()}</p>
                  <p>By: {approval.requestedBy.name || approval.requestedBy.email}</p>
                  {approval.comment && <p>Note: {approval.comment}</p>}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
