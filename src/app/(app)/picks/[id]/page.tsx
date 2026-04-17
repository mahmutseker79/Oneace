import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";

import {
  assignPickTaskAction,
  completePickTaskAction,
  startPickTaskAction,
  verifyPickTaskAction,
} from "../actions";

export const metadata: Metadata = {
  title: "Pick",
};

function statusBadge(status: string) {
  if (status === "PENDING") return <Badge variant="secondary">{status}</Badge>;
  if (status === "ASSIGNED") return <Badge variant="info">{status}</Badge>;
  if (status === "IN_PROGRESS") return <Badge variant="processing">{status}</Badge>;
  if (status === "PICKED") return <Badge variant="warning">{status}</Badge>;
  if (status === "VERIFIED") return <Badge variant="success">{status}</Badge>;
  if (status === "CANCELLED") return <Badge variant="destructive">{status}</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

export default async function PickTaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { membership, session } = await requireActiveMembership();
  const _t = await getMessages();

  const task = await db.pickTask.findFirst({
    where: { id, organizationId: membership.organizationId },
    include: {
      item: { select: { id: true, name: true, sku: true, unit: true } },
      warehouse: { select: { id: true, name: true } },
    },
  });

  if (!task) notFound();

  const canAssign = hasCapability(membership.role, "picks.assign");
  const canStart = hasCapability(membership.role, "picks.start");
  const canComplete = hasCapability(membership.role, "picks.complete");
  const canVerify = hasCapability(membership.role, "picks.verify");

  return (
    <div className="space-y-6 max-w-2xl">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/picks">
          <ChevronLeft className="h-4 w-4" />
          Back to picks
        </Link>
      </Button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Pick #{task.id.slice(0, 8)}</h1>
          <p className="text-muted-foreground">
            {task.item?.name ?? task.itemId} · {task.quantity} {task.item?.unit ?? "units"}
          </p>
        </div>
        {statusBadge(task.status)}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-normal">Item</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href={`/items/${task.itemId}`} className="font-medium hover:underline">
              {task.item?.name ?? task.itemId}
            </Link>
            <p className="text-xs text-muted-foreground font-mono">{task.item?.sku ?? "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-normal">Warehouse</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{task.warehouse?.name ?? task.warehouseId}</p>
            {task.fromBinId && (
              <p className="text-xs text-muted-foreground">Bin: {task.fromBinId}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-normal">Quantity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{task.quantity}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-normal">Assigned</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{task.assignedToUserId ?? "Unassigned"}</p>
          </CardContent>
        </Card>
      </div>

      {task.note && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-normal">Note</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{task.note}</p>
          </CardContent>
        </Card>
      )}

      {/* Action buttons wired to server actions */}
      <div className="flex gap-3 flex-wrap">
        {task.status === "PENDING" && canAssign && (
          <form
            action={async (formData: FormData) => {
              "use server";
              await assignPickTaskAction(formData);
            }}
          >
            <input type="hidden" name="taskId" value={task.id} />
            <input type="hidden" name="assignedToUserId" value={session.user.id} />
            <Button type="submit">Assign to Me</Button>
          </form>
        )}

        {task.status === "ASSIGNED" && canStart && (
          <form
            action={async () => {
              "use server";
              await startPickTaskAction(task.id);
            }}
          >
            <Button type="submit">Start Pick</Button>
          </form>
        )}

        {task.status === "IN_PROGRESS" && canComplete && (
          <form
            action={async (formData: FormData) => {
              "use server";
              await completePickTaskAction(formData);
            }}
          >
            <input type="hidden" name="taskId" value={task.id} />
            <Button type="submit">Mark as Picked</Button>
          </form>
        )}

        {task.status === "PICKED" && canVerify && (
          <form
            action={async () => {
              "use server";
              await verifyPickTaskAction(task.id);
            }}
          >
            <Button type="submit" variant="default">
              Verify & Complete
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
