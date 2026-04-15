"use client";

import { Pencil } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { updateCategoryAction } from "./actions";

export type CategoryRenameDialogLabels = {
  trigger: string;
  title: string;
  body: string;
  nameLabel: string;
  cancel: string;
  submit: string;
};

type CategoryRenameDialogProps = {
  categoryId: string;
  currentName: string;
  labels: CategoryRenameDialogLabels;
};

export function CategoryRenameDialog({
  categoryId,
  currentName,
  labels,
}: CategoryRenameDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setName(currentName);
      setError(null);
      setFieldErrors({});
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await updateCategoryAction(categoryId, formData);
      if (!result.ok) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  const fieldError = fieldErrors.name?.[0];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={labels.trigger}>
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{labels.title}</DialogTitle>
            <DialogDescription>{labels.body}</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor={`category-rename-${categoryId}`}>{labels.nameLabel}</Label>
            <Input
              id={`category-rename-${categoryId}`}
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              aria-invalid={!!fieldError}
              autoFocus
            />
            {fieldError ? <p className="text-xs text-destructive">{fieldError}</p> : null}
          </div>

          {error ? (
            <div className="rounded-md border border-destructive bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              {labels.cancel}
            </Button>
            <Button type="submit" disabled={isPending || name.trim() === ""}>
              {labels.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
