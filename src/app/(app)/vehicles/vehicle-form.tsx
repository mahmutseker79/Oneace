"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { PageHeader } from "@/components/ui/page-header";

import { createVehicleAction, updateVehicleAction } from "./actions";

type Props = {
  vehicleId?: string;
  initialData?: {
    name: string;
    licensePlate: string;
    description: string;
    notes: string;
  };
  labels: {
    newVehicleHeading: string;
    editVehicle: string;
    columnName: string;
    columnLicensePlate: string;
    columnDescription: string;
    backToList: string;
    created: string;
    updated: string;
    errors: { createFailed: string; updateFailed: string };
  };
};

export default function VehicleForm({ vehicleId, initialData, labels }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(initialData?.name ?? "");
  const [licensePlate, setLicensePlate] = useState(initialData?.licensePlate ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [notes, setNotes] = useState(initialData?.notes ?? "");
  const isEdit = !!vehicleId;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const input = { name, licensePlate, description, notes };
      const result = isEdit
        ? await updateVehicleAction(vehicleId!, input)
        : await createVehicleAction(input);

      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/vehicles");
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title={isEdit ? labels.editVehicle : labels.newVehicleHeading} />

      <form
        onSubmit={handleSubmit}
        className="border-border bg-card space-y-4 rounded-lg border p-6"
      >
        {error && (
          <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">{error}</div>
        )}

        <div>
          <label className="text-sm font-medium">{labels.columnName}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="border-input bg-background mt-1 block w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="text-sm font-medium">{labels.columnLicensePlate}</label>
          <input
            type="text"
            value={licensePlate}
            onChange={(e) => setLicensePlate(e.target.value)}
            required
            className="border-input bg-background mt-1 block w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="text-sm font-medium">{labels.columnDescription}</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
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

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={isPending}
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {isPending ? "Saving…" : isEdit ? labels.editVehicle : labels.newVehicleHeading}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="border-input hover:bg-muted rounded-md border px-4 py-2 text-sm"
          >
            {labels.backToList}
          </button>
        </div>
      </form>
    </div>
  );
}
