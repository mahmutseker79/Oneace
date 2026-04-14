"use client";

import { ArrowRightLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { binTransferAction } from "./bin-transfer-action";

export type BinTransferLabels = {
  title: string;
  trigger: string;
  item: string;
  fromBin: string;
  toBin: string;
  quantity: string;
  submit: string;
  cancel: string;
};

type BinOption = { id: string; code: string; label: string | null };
type ItemOption = { id: string; sku: string; name: string };

type BinTransferDialogProps = {
  warehouseId: string;
  labels: BinTransferLabels;
  bins: BinOption[];
  items: ItemOption[];
};

export function BinTransferDialog({ warehouseId, labels, bins, items }: BinTransferDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await binTransferAction(warehouseId, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      formRef.current?.reset();
      router.refresh();
    });
  }

  if (bins.length < 2) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <ArrowRightLeft className="h-4 w-4" />
          {labels.trigger}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{labels.title}</DialogTitle>
        </DialogHeader>

        <form ref={formRef} action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bt-item">{labels.item}</Label>
            <select
              id="bt-item"
              name="itemId"
              required
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">—</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.sku} — {item.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bt-from">{labels.fromBin}</Label>
            <select
              id="bt-from"
              name="fromBinId"
              required
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">—</option>
              {bins.map((bin) => (
                <option key={bin.id} value={bin.id}>
                  {bin.code} {bin.label ? `(${bin.label})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bt-to">{labels.toBin}</Label>
            <select
              id="bt-to"
              name="toBinId"
              required
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">—</option>
              {bins.map((bin) => (
                <option key={bin.id} value={bin.id}>
                  {bin.code} {bin.label ? `(${bin.label})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bt-qty">{labels.quantity}</Label>
            <Input id="bt-qty" name="quantity" type="number" min={1} required defaultValue={1} />
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
              {labels.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
