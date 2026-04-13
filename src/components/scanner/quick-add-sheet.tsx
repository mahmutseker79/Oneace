"use client";

import { Loader2, Package, Plus } from "lucide-react";
import { useCallback, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import { type QuickCreateResult, quickCreateItemAction } from "@/app/(app)/scan/quick-create-action";

export type QuickAddLabels = {
  title: string;
  description: string;
  barcodeLabel: string;
  nameLabel: string;
  namePlaceholder: string;
  createButton: string;
  creating: string;
  errorGeneric: string;
};

type QuickAddSheetProps = {
  open: boolean;
  barcode: string;
  labels: QuickAddLabels;
  onClose: () => void;
  onCreated: (item: { id: string; name: string; sku: string }) => void;
};

export function QuickAddSheet({
  open,
  barcode,
  labels,
  onClose,
  onCreated,
}: QuickAddSheetProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = name.trim();
      if (!trimmed) return;

      setError(null);
      startTransition(async () => {
        const result: QuickCreateResult = await quickCreateItemAction({
          barcode,
          name: trimmed,
        });
        if (result.ok) {
          setName("");
          onCreated({ id: result.id, name: result.name, sku: result.sku });
        } else {
          setError(result.error || labels.errorGeneric);
        }
      });
    },
    [barcode, name, labels.errorGeneric, onCreated],
  );

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="rounded-t-xl">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {labels.title}
          </SheetTitle>
          <SheetDescription>{labels.description}</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="qa-barcode">{labels.barcodeLabel}</Label>
            <Input
              id="qa-barcode"
              value={barcode}
              readOnly
              className="font-mono bg-muted"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qa-name">{labels.nameLabel}</Label>
            <Input
              id="qa-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={labels.namePlaceholder}
              disabled={isPending}
              autoFocus
              autoComplete="off"
            />
          </div>

          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}

          <Button
            type="submit"
            disabled={isPending || name.trim() === ""}
            className="w-full h-12 text-base"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            {isPending ? labels.creating : labels.createButton}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
