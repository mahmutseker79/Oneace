// Pick task detail page
"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function PickTaskDetailPage({ params }: { params: { id: string } }) {
  const [task, setTask] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useState(() => {
    // TODO: Fetch pick task by ID
    setIsLoading(false);
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!task) {
    return <div>Pick task not found</div>;
  }

  const statusColors: Record<
    string,
    "default" | "destructive" | "outline" | "secondary" | undefined
  > = {
    PENDING: "secondary",
    ASSIGNED: "default",
    IN_PROGRESS: "default",
    PICKED: "default",
    VERIFIED: "default",
    CANCELLED: "destructive",
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Pick Task #{task.id.slice(0, 8)}</h1>
          <p className="text-muted-foreground">{task.itemId}</p>
        </div>
        <Badge variant={statusColors[task.status] || "default"} className="text-lg px-4 py-2">
          {task.status}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Item</p>
          <p className="font-semibold">{task.itemId}</p>
          {task.variantId && <p className="text-sm text-muted-foreground">{task.variantId}</p>}
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Warehouse</p>
          <p className="font-semibold">{task.warehouseId}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Bin</p>
          <p className="font-semibold">{task.fromBinId || "Not specified"}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Quantity</p>
          <p className="font-semibold">{task.quantity}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Assigned To</p>
          <p className="font-semibold">{task.assignedToUser?.name || "Unassigned"}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Sales Order Line</p>
          <p className="font-semibold">{task.salesOrderLineId ? "Linked" : "Manual"}</p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm">
          <strong>Instructions:</strong> Pick {task.quantity} unit{task.quantity > 1 ? "s" : ""} of {task.itemId} from{" "}
          {task.fromBinId ? `bin ${task.fromBinId}` : `${task.warehouseId}`}.
        </p>
      </div>

      <div className="flex gap-3 flex-wrap">
        {task.status === "PENDING" && (
          <>
            <Button>Assign to Me</Button>
            <Button variant="outline">Assign to User</Button>
          </>
        )}
        {task.status === "ASSIGNED" && (
          <>
            <Button>Start Pick</Button>
            <Button variant="outline">Unassign</Button>
          </>
        )}
        {task.status === "IN_PROGRESS" && (
          <>
            <Button>Mark as Picked</Button>
            <Button variant="outline">Cancel Pick</Button>
          </>
        )}
        {task.status === "PICKED" && (
          <>
            <Button>Verify & Complete</Button>
            <Button variant="outline">Back to Picking</Button>
          </>
        )}
      </div>

      {task.note && (
        <div className="rounded-lg border p-4 bg-muted/50">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Note</p>
          <p className="text-sm">{task.note}</p>
        </div>
      )}
    </div>
  );
}
