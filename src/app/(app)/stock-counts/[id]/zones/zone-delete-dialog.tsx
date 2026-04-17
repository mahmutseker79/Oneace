"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteZoneAction } from "./actions";

export type ZoneDeleteDialogLabels = {
  deleteTitle: string;
  deleteConfirm: string;
  deleteButton: string;
  cancelButton: string;
};

interface ZoneDeleteDialogProps {
  zoneId: string;
  zoneName: string;
  countId: string;
  labels: ZoneDeleteDialogLabels;
}

export function ZoneDeleteDialog({ zoneId, zoneName, countId, labels }: ZoneDeleteDialogProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteZoneAction(zoneId);
      if (result.ok) {
        setIsOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setIsOpen(true)}
        disabled={isPending}
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{labels.deleteTitle}</DialogTitle>
            <DialogDescription>
              {labels.deleteConfirm}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm">
              <strong>{zoneName}</strong>
            </p>

            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
                disabled={isPending}
              >
                {labels.cancelButton}
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isPending}
              >
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {labels.deleteButton}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
