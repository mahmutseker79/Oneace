"use client";

import { Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

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

import { createBinAction, updateBinAction } from "./actions";

export type BinFormLabels = {
  code: string;
  codeHelp: string;
  label: string;
  labelHelp: string;
  description: string;
  save: string;
  cancel: string;
  newBin: string;
};

type BinFormDialogProps = {
  warehouseId: string;
  labels: BinFormLabels;
} & (
  | { mode: "create"; bin?: never }
  | {
      mode: "edit";
      bin: {
        id: string;
        code: string;
        label: string | null;
        description: string | null;
      };
    }
);

export function BinFormDialog({ warehouseId, labels, mode, bin }: BinFormDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const result =
        mode === "edit"
          ? await updateBinAction(warehouseId, bin.id, formData)
          : await createBinAction(warehouseId, formData);

      if (!result.ok) {
        setError(result.error);
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        return;
      }
      setOpen(false);
      formRef.current?.reset();
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) {
          setError(null);
          setFieldErrors({});
        }
      }}
    >
      <DialogTrigger asChild>
        {mode === "edit" ? (
          // P3-3 (audit v1.0 §9.4) — icon-only buttons must expose an
          // accessible name; the pencil has no visible label so we add
          // aria-label so SR users know what the trigger does.
          <Button variant="ghost" size="sm" aria-label={labels.label}>
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
          <Button>
            <Plus className="h-4 w-4" />
            {labels.newBin}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? labels.label : labels.newBin}</DialogTitle>
          {/* P3-3 (audit v1.0 §9.4) — Radix's Dialog warns at runtime
              when an accessible description is missing. The form
              labels already describe each field, so a short
              screen-reader-only summary is the lightest fix. */}
          <DialogDescription className="sr-only">
            {mode === "edit"
              ? "Edit this bin's code, label, and description."
              : "Create a new storage bin inside this warehouse."}
          </DialogDescription>
        </DialogHeader>

        <form ref={formRef} action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bin-code">
              {labels.code}
              <span className="ml-0.5 text-destructive" aria-hidden>
                *
              </span>
            </Label>
            <Input
              id="bin-code"
              name="code"
              defaultValue={mode === "edit" ? bin.code : ""}
              required
              maxLength={32}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">{labels.codeHelp}</p>
            {fieldErrors.code?.map((msg) => (
              <p key={msg} className="text-xs text-destructive">
                {msg}
              </p>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="bin-label">{labels.label}</Label>
            <Input
              id="bin-label"
              name="label"
              defaultValue={mode === "edit" ? (bin.label ?? "") : ""}
              maxLength={80}
            />
            <p className="text-xs text-muted-foreground">{labels.labelHelp}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bin-description">{labels.description}</Label>
            <Input
              id="bin-description"
              name="description"
              defaultValue={mode === "edit" ? (bin.description ?? "") : ""}
              maxLength={200}
            />
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
              disabled={isPending}
              onClick={() => setOpen(false)}
            >
              {labels.cancel}
            </Button>
            <Button type="submit" disabled={isPending}>
              {labels.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
