"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { IntegrationSyncSchedule } from "@/generated/prisma";
import { useState } from "react";
import { toast } from "sonner";
import { deleteSyncScheduleAction, upsertSyncScheduleAction } from "../actions";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";

interface SyncSchedulesPanelProps {
  integrationId: string;
  schedules: IntegrationSyncSchedule[];
}

const CRON_PRESETS = {
  "0 0 * * *": "Daily at midnight",
  "0 9 * * *": "Daily at 9:00 AM",
  "0 */6 * * *": "Every 6 hours",
  "0 */4 * * *": "Every 4 hours",
  "0 * * * *": "Hourly",
  "*/30 * * * *": "Every 30 minutes",
  "0 0 * * 0": "Weekly (Sundays at midnight)",
  "0 0 1 * *": "Monthly (1st at midnight)",
};

export function SyncSchedulesPanel({ integrationId, schedules }: SyncSchedulesPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);

  const [formData, setFormData] = useState({
    entityType: "ITEM",
    direction: "INBOUND",
    cronExpression: "0 0 * * *",
  });

  const handleDelete = async (scheduleId: string) => {
    if (!confirm("Delete this sync schedule?")) return;

    setIsLoading(true);
    const result = await deleteSyncScheduleAction(scheduleId);
    setIsLoading(false);

    if (result.ok) {
      toast.success("Sync schedule deleted");
    } else {
      toast.error(result.error || "Failed to delete schedule");
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsLoading(true);
    const result = await upsertSyncScheduleAction({
      integrationId,
      entityType: formData.entityType,
      direction: formData.direction,
      cronExpression: formData.cronExpression,
    });
    setIsLoading(false);

    if (result.ok) {
      toast.success("Sync schedule saved");
      setFormData({
        entityType: "ITEM",
        direction: "INBOUND",
        cronExpression: "0 0 * * *",
      });
      setShowDialog(false);
    } else {
      toast.error(result.error || "Failed to save schedule");
    }
  };

  const groupedSchedules = schedules.reduce(
    (acc, schedule) => {
      const key = `${schedule.entityType}-${schedule.direction}`;
      acc[key] = schedule;
      return acc;
    },
    {} as Record<string, IntegrationSyncSchedule>,
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Sync Schedules</CardTitle>
            <CardDescription>
              Configure cron-based schedules for automatic syncing of specific entity types.
            </CardDescription>
          </div>
          <Button onClick={() => setShowDialog(true)} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Schedule
          </Button>
        </CardHeader>
        <CardContent>
          {Object.entries(groupedSchedules).length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">No sync schedules configured.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(groupedSchedules).map(([key, schedule]) => (
                <div
                  key={schedule.id}
                  className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-medium">{schedule.entityType}</h4>
                      <Badge variant="secondary" className="text-xs">
                        {schedule.direction}
                      </Badge>
                      {!schedule.isActive && (
                        <Badge variant="destructive" className="text-xs">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">
                      {schedule.cronExpression}
                    </p>
                    {schedule.nextRunAt && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Next run: {new Date(schedule.nextRunAt).toLocaleString()}
                      </p>
                    )}
                    {schedule.lastRunAt && (
                      <p className="text-xs text-muted-foreground">
                        Last run: {new Date(schedule.lastRunAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(schedule.id)}
                    disabled={isLoading}
                    className="ml-4"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Schedule Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Sync Schedule</DialogTitle>
            <DialogDescription>
              Create a cron schedule for automatic synchronization of a specific entity type.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="entity">Entity Type</Label>
                <Select
                  value={formData.entityType}
                  onValueChange={(value) =>
                    setFormData({ ...formData, entityType: value })
                  }
                >
                  <SelectTrigger id="entity">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ITEM">Item</SelectItem>
                    <SelectItem value="STOCK_LEVEL">Stock Level</SelectItem>
                    <SelectItem value="SUPPLIER">Supplier</SelectItem>
                    <SelectItem value="PURCHASE_ORDER">Purchase Order</SelectItem>
                    <SelectItem value="CATEGORY">Category</SelectItem>
                    <SelectItem value="WAREHOUSE">Warehouse</SelectItem>
                    <SelectItem value="CUSTOMER">Customer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="direction">Direction</Label>
                <Select
                  value={formData.direction}
                  onValueChange={(value) =>
                    setFormData({ ...formData, direction: value })
                  }
                >
                  <SelectTrigger id="direction">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INBOUND">Inbound</SelectItem>
                    <SelectItem value="OUTBOUND">Outbound</SelectItem>
                    <SelectItem value="BIDIRECTIONAL">Bidirectional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="presets">Quick presets</Label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(CRON_PRESETS).map(([cron, label]) => (
                  <button
                    key={cron}
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, cronExpression: cron })
                    }
                    className={`p-2 text-xs text-left border rounded hover:bg-muted transition ${
                      formData.cronExpression === cron
                        ? "bg-primary text-primary-foreground border-primary"
                        : ""
                    }`}
                  >
                    <div className="font-medium">{label}</div>
                    <div className="text-muted-foreground font-mono text-xs mt-1">
                      {cron}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cron">Cron Expression</Label>
              <Input
                id="cron"
                placeholder="0 0 * * * (Daily at midnight UTC)"
                value={formData.cronExpression}
                onChange={(e) =>
                  setFormData({ ...formData, cronExpression: e.target.value })
                }
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Enter a cron expression (minute hour day month weekday). Example: 0 9 * * * (9:00 AM daily)
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDialog(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Saving..." : "Save Schedule"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
