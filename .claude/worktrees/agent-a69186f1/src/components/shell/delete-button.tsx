"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

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

export type DeleteButtonLabels = {
  trigger: string;
  title: string;
  body: string;
  cancel: string;
  confirm: string;
};

export type DeleteActionResult = { ok: true } | { ok: false; error: string };

type DeleteButtonProps = {
  labels: DeleteButtonLabels;
  /**
   * Pass a server action pre-bound with `.bind(null, id)`. Anything with an
   * `ok` discriminant is accepted so the stricter `ActionResult` types from
   * entity action files are assignable without ceremony.
   */
  action: () => Promise<{ ok: true } | { ok: false; error: string }>;
  /**
   * Optional icon-only variant for dense rows.
   */
  iconOnly?: boolean;
};

export function DeleteButton({ labels, action, iconOnly }: DeleteButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) setError(null);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          aria-label={labels.trigger}
        >
          <Trash2 className="h-4 w-4" />
          {iconOnly ? null : labels.trigger}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{labels.title}</AlertDialogTitle>
          <AlertDialogDescription>{labels.body}</AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <div className="rounded-md border border-destructive bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>{labels.cancel}</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={(event) => {
              // Prevent Radix from auto-closing before the server action resolves.
              event.preventDefault();
              handleConfirm();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {labels.confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
