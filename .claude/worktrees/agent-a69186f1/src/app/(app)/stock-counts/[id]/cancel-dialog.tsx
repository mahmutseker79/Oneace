"use client";

import { Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { cancelStockCountAction } from "../actions";

export type CancelDialogLabels = {
  trigger: string;
  title: string;
  body: string;
  placeholder: string;
  confirm: string;
  keep: string;
  genericError: string;
};

type CancelDialogProps = {
  countId: string;
  labels: CancelDialogLabels;
};

// A small client wrapper: button → dialog → reason textarea → submit.
// Separating this lets the detail page stay a server component and only
// the dialog itself hydrates on the client.
export function CancelDialog({ countId, labels }: CancelDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    setError(null);
    if (reason.trim().length < 3) {
      setError(labels.genericError);
      return;
    }
    startTransition(async () => {
      const result = await cancelStockCountAction({
        countId,
        reason: reason.trim(),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setReason("");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <X className="h-4 w-4" />
          {labels.trigger}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{labels.title}</DialogTitle>
          <DialogDescription>{labels.body}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="cancel-reason" className="sr-only">
            {labels.title}
          </Label>
          <Textarea
            id="cancel-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={labels.placeholder}
            rows={3}
            maxLength={500}
          />
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
            {labels.keep}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={isPending || reason.trim().length < 3}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {labels.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
