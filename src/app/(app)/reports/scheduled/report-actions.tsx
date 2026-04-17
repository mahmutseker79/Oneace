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
import { Button } from "@/components/ui/button";

import type { Messages } from "@/lib/i18n";
import { deleteScheduledReport, updateScheduledReport } from "./actions";

interface Props {
  id: string;
  isActive: boolean;
  labels: Messages["reports"]["scheduledReportActions"];
}

export function ScheduledReportActions({ id, isActive, labels }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);

  function toggleActive() {
    startTransition(async () => {
      const res = await updateScheduledReport({ id, isActive: !isActive });
      if (res.ok) {
        toast.success(isActive ? labels.pausedToast : labels.resumedToast);
        router.refresh();
      } else {
        toast.error(res.error ?? labels.updateError);
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteScheduledReport(id);
      if (res.ok) {
        toast.success(labels.deletedToast);
        setDeleteOpen(false);
        router.refresh();
      } else {
        toast.error(res.error ?? labels.deleteError);
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
        title={isActive ? labels.pauseTitle : labels.resumeTitle}
      >
        {isActive ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
      </Button>
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="sm" disabled={pending} title={labels.deleteTitle}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{labels.deleteDialogTitle}</AlertDialogTitle>
            <AlertDialogDescription>{labels.deleteDialogDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{labels.deleteCancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={pending}>
              {labels.deleteConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
