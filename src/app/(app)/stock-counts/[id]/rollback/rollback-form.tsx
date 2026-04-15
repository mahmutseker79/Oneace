"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

import { rollbackCountAction } from "./actions";

interface RollbackFormProps {
  countId: string;
}

export function RollbackForm({ countId }: RollbackFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [reason, setReason] = useState("");

  const handleRollback = () => {
    if (!reason.trim()) {
      toast.error("Please provide a reason for rollback");
      return;
    }

    if (!confirm("This will revert all stock adjustments. Are you sure?")) return;

    startTransition(async () => {
      const result = await rollbackCountAction({ countId, reason });
      if (result.ok) {
        toast.success("Count rolled back");
        router.push(`/stock-counts/${countId}`);
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleRollback(); }} className="space-y-4">
      <div>
        <Label htmlFor="reason">Reason for Rollback</Label>
        <Textarea
          id="reason"
          placeholder="Explain why this count is being rolled back..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={isPending}
          rows={4}
          className="mt-2"
          required
        />
      </div>

      <Button
        type="submit"
        onClick={handleRollback}
        disabled={isPending}
        variant="destructive"
        className="w-full"
      >
        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Rollback Count
      </Button>
    </form>
  );
}
