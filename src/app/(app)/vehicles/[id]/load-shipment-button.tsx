"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { loadShipmentAction } from "../actions";

type Props = {
  vehicleId: string;
  labels: {
    assignShipment: string;
    assignShipmentTitle: string;
    assignShipmentDescription: string;
    salesOrderIdHelp: string;
    assignButton: string;
    shipmentLoaded: string;
    errors: { loadFailed: string };
  };
};

export default function LoadShipmentButton({ vehicleId, labels }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [salesOrderId, setSalesOrderId] = useState("");
  const [notes, setNotes] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await loadShipmentAction({
        vehicleId,
        salesOrderId: salesOrderId || undefined,
        notes: notes || undefined,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setOpen(false);
      setSalesOrderId("");
      setNotes("");
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium"
      >
        {labels.assignShipment}
      </button>
    );
  }

  return (
    <div className="border-border bg-card w-full max-w-md rounded-lg border p-4">
      <h3 className="font-medium">{labels.assignShipmentTitle}</h3>
      <p className="text-muted-foreground text-sm">{labels.assignShipmentDescription}</p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        {error && (
          <div className="bg-destructive/10 text-destructive rounded-md p-2 text-sm">{error}</div>
        )}

        <div>
          <label className="text-sm font-medium">Sales Order ID</label>
          <input
            type="text"
            value={salesOrderId}
            onChange={(e) => setSalesOrderId(e.target.value)}
            placeholder={labels.salesOrderIdHelp}
            className="border-input bg-background mt-1 block w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="border-input bg-background mt-1 block w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {isPending ? "Loading…" : labels.assignButton}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="border-input hover:bg-muted rounded-md border px-4 py-2 text-sm"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
