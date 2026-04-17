"use client";

import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

import { createPalletAction } from "./actions";

interface PalletFormProps {
  initialData?: {
    itemIds?: string[];
    warehouseId?: string;
    binId?: string;
    notes?: string;
    quantity?: number;
  };
}

export function PalletLabelForm({ initialData }: PalletFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleSubmit = useCallback(
    async (formData: FormData) => {
      startTransition(async () => {
        try {
          // Parse form data
          const itemIds = formData.getAll("itemIds") as string[];
          const warehouseId = (formData.get("warehouseId") as string) || "";
          const binId = formData.get("binId") as string;
          const notes = formData.get("notes") as string;
          const quantity = Number.parseInt(formData.get("quantity") as string) || 1;
          const barcodeValue = formData.get("barcodeValue") as string;

          const result = await createPalletAction({
            itemIds: itemIds.filter((id) => id.trim().length > 0),
            warehouseId,
            binId: binId && binId.trim().length > 0 ? binId : null,
            notes: notes && notes.trim().length > 0 ? notes : null,
            quantity,
            barcodeValue: barcodeValue && barcodeValue.trim().length > 0 ? barcodeValue : null,
          });

          if (!result.ok) {
            toast.error(result.error);
            return;
          }

          toast.success("Pallet label created successfully");
          router.push("/pallets");
        } catch (error) {
          toast.error("Failed to create pallet label");
          console.error(error);
        }
      });
    },
    [router],
  );

  return (
    <form action={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Pallet Details</CardTitle>
          <CardDescription>Enter the items and location for this pallet</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Items section */}
          <div className="space-y-2">
            <Label htmlFor="itemIds">
              Item SKUs or IDs <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="itemIds"
              name="itemIds"
              placeholder="Enter one or more item IDs/SKUs (one per line)"
              defaultValue={initialData?.itemIds?.join("\n") || ""}
              className="min-h-20"
              required
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">
              Enter each item ID on a separate line. At least one item is required.
            </p>
          </div>

          {/* Warehouse section */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="warehouseId">
                Warehouse <span className="text-destructive">*</span>
              </Label>
              <Input
                id="warehouseId"
                name="warehouseId"
                placeholder="Warehouse ID or name"
                defaultValue={initialData?.warehouseId || ""}
                required
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="binId">Bin (optional)</Label>
              <Input
                id="binId"
                name="binId"
                placeholder="Bin code or ID"
                defaultValue={initialData?.binId || ""}
                disabled={isPending}
              />
            </div>
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <Label htmlFor="quantity">
              Quantity <span className="text-destructive">*</span>
            </Label>
            <Input
              id="quantity"
              name="quantity"
              type="number"
              min="1"
              max="1000000"
              defaultValue={initialData?.quantity || 1}
              required
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">Total number of items on this pallet</p>
          </div>

          {/* Barcode value */}
          <div className="space-y-2">
            <Label htmlFor="barcodeValue">Barcode Value (optional)</Label>
            <Input
              id="barcodeValue"
              name="barcodeValue"
              placeholder="Leave blank to auto-generate"
              defaultValue={initialData ? "" : ""}
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to generate a unique barcode automatically
            </p>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              name="notes"
              placeholder="Additional notes about this pallet"
              defaultValue={initialData?.notes || ""}
              disabled={isPending}
              className="min-h-20"
            />
          </div>

          {/* Submit button */}
          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating..." : "Create Pallet Label"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => window.history.back()}
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
