"use client";

import { Trash2 } from "lucide-react";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";

import { removeTransferLineAction } from "../actions";

interface RemoveLineButtonProps {
  lineId: string;
  transferId: string;
}

export function RemoveLineButton({ lineId }: RemoveLineButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleRemove = () => {
    if (!confirm("Remove this line from the transfer?")) return;
    startTransition(async () => {
      await removeTransferLineAction(lineId);
    });
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleRemove}
      disabled={isPending}
      className="text-destructive hover:text-destructive/80"
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
