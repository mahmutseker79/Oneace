"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { toast } from "sonner";

import { removeAssignmentAction } from "./actions";

interface AssignmentDeleteButtonProps {
  id: string;
}

export function AssignmentDeleteButton({ id }: AssignmentDeleteButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (!confirm("Remove this assignment?")) return;

    startTransition(async () => {
      const result = await removeAssignmentAction({ id });
      if (result.ok) {
        toast.success("Assignment removed");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={handleDelete}
      disabled={isPending}
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Trash2 className="h-4 w-4" />
      )}
    </Button>
  );
}
