"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { cancelTransferAction } from "../actions";

interface CancelTransferButtonProps {
  transferId: string;
}

export function CancelTransferButton({ transferId }: CancelTransferButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleCancel = () => {
    setError(null);
    startTransition(async () => {
      const result = await cancelTransferAction(transferId);
      if (!result.ok) {
        setError(result.error);
      }
    });
  };

  return (
    <>
      {error && (
        <div className="w-full rounded-md bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" disabled={isPending}>
            <X className="mr-2 h-4 w-4" />
            Cancel Transfer
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogTitle>Cancel Transfer</AlertDialogTitle>
          <AlertDialogDescription>
            This will cancel the transfer and restore any deducted stock to the source warehouse.
            This action cannot be undone.
          </AlertDialogDescription>
          <div className="flex gap-3">
            <AlertDialogCancel>Keep Transfer</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} disabled={isPending} className="bg-red-600">
              {isPending ? "Cancelling..." : "Cancel Transfer"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
