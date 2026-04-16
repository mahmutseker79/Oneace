"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { CountApproval } from "@/generated/prisma";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

import { approveCountAction, rejectCountAction } from "./actions";

interface ApprovalFormProps {
  countId: string;
  approval: CountApproval;
}

export function ApprovalForm({ countId, approval: _approval }: ApprovalFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [comment, setComment] = useState("");

  const handleApprove = () => {
    startTransition(async () => {
      const result = await approveCountAction({ countId, comment });
      if (result.ok) {
        toast.success("Count approved");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleReject = () => {
    if (!comment.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }

    startTransition(async () => {
      const result = await rejectCountAction({ countId, comment });
      if (result.ok) {
        toast.success("Count rejected");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="space-y-4 rounded-lg border p-6">
      <div>
        <Label htmlFor="comment">Comment</Label>
        <Textarea
          id="comment"
          placeholder="Add notes about your decision..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          disabled={isPending}
          rows={4}
          className="mt-2"
        />
      </div>

      <div className="flex gap-2">
        <Button onClick={handleApprove} disabled={isPending} variant="default">
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Approve
        </Button>
        <Button onClick={handleReject} disabled={isPending} variant="destructive">
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Reject
        </Button>
      </div>
    </div>
  );
}
