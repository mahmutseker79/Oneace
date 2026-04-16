"use client";

/**
 * Phase D — Scheduled Reports row actions
 *
 * Small client component that exposes pause/resume and delete on each
 * row of the scheduled reports list. Calls the server actions defined
 * alongside — no additional API routes needed.
 */

import { PauseCircle, PlayCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { deleteScheduledReport, updateScheduledReport } from "./actions";

interface Props {
  id: string;
  isActive: boolean;
}

export function ScheduledReportActions({ id, isActive }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);

  function toggleActive() {
    startTransition(async () => {
      const res = await updateScheduledReport({ id, isActive: !isActive });
      if (res.ok) {
        toast.success(isActive ? "Report paused" : "Report resumed");
        router.refresh();
      } else {
        toast.error(res.error ?? "Failed to update report");
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteScheduledReport(id);
      if (res.ok) {
        toast.success("Report deleted");
        setDeleteOpen(false);
        router.refresh();
      } else {
        toast.error(res.error ?? "Failed to delete report");
      }
    });
  }

  return (
    <div className="flex justify-end gap-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleActive}
        disabled={pending}
        title={isActive ? "Pause" : "Resume"}
      >
        {isActive ? (
          <PauseCircle className="h-4 w-4" />
        ) : (
          <PlayCircle className="h-4 w-4" />
        )}
      </Button>
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="sm" disabled={pending} title="Delete">
            <Trash2 className="h-4 w-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this scheduled report?</AlertDialogTitle>
            <AlertDialogDescription>
              No more emails will be sent. Past deliveries are not affected. This cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={pending}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
