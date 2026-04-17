"use client";

import { Truck } from "lucide-react";
import { useState } from "react";
import { useTransition } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

import { shipTransferAction } from "../actions";

interface ShipTransferButtonProps {
  transferId: string;
}

export function ShipTransferButton({ transferId }: ShipTransferButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleShip = () => {
    setError(null);
    startTransition(async () => {
      const result = await shipTransferAction(transferId);
      if (!result.ok) {
        setError(result.error);
      }
    });
  };

  return (
    <>
      {error && (
        <div className="w-full rounded-md bg-destructive-light p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="default" disabled={isPending}>
            <Truck className="mr-2 h-4 w-4" />
            Ship Transfer
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogTitle>Ship Transfer</AlertDialogTitle>
          <AlertDialogDescription>
            This will mark the transfer as shipped and deduct items from the source warehouse. This
            action cannot be undone.
          </AlertDialogDescription>
          <div className="flex gap-3">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleShip} disabled={isPending}>
              {isPending ? "Shipping..." : "Ship Transfer"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
