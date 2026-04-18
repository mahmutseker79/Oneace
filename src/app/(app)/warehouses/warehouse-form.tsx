"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { useUnsavedWarning } from "@/hooks/use-unsaved-warning";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Warehouse } from "@/generated/prisma";
// Audit v1.2 §5.33 — client-side analytics seam; see items/item-form.tsx
// for the design rationale (track() is a server-side no-op).
import { AnalyticsEvents } from "@/lib/analytics/events";
import { track } from "@/lib/instrumentation";

import { createWarehouseAction, updateWarehouseAction } from "./actions";

export type WarehouseFormLabels = {
  fields: {
    name: string;
    code: string;
    codeHelp: string;
    address: string;
    city: string;
    region: string;
    country: string;
    isDefault: string;
    isDefaultHelp: string;
  };
  common: {
    save: string;
    saveChanges: string;
    cancel: string;
    optional: string;
  };
  errors: {
    createFailed: string;
    updateFailed: string;
  };
  backHref: string;
};

type WarehouseFormProps = {
  labels: WarehouseFormLabels;
  mode: "create" | "edit";
  initial?: Pick<
    Warehouse,
    "id" | "name" | "code" | "address" | "city" | "region" | "country" | "isDefault"
  >;
};

export function WarehouseForm({ labels, mode, initial }: WarehouseFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [isDefault, setIsDefault] = useState<boolean>(initial?.isDefault ?? false);
  const { reset: resetUnsaved, setDirty } = useUnsavedWarning();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    const formData = new FormData(event.currentTarget);
    formData.set("isDefault", isDefault ? "true" : "false");

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createWarehouseAction(formData)
          : await updateWarehouseAction(initial?.id ?? "", formData);

      if (!result.ok) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      // v1.2 §5.33 — one-time FIRST_WAREHOUSE_CREATED fires only when
      // the server action reports this was the org's first active
      // warehouse. No steady-state `WAREHOUSE_CREATED` event is in
      // the taxonomy — warehouses are low-frequency and the FIRST_*
      // signal is the only one product cares about for activation.
      if (mode === "create" && result.isFirst) {
        track(AnalyticsEvents.FIRST_WAREHOUSE_CREATED, { id: result.id });
      }
      resetUnsaved();
      router.push("/warehouses");
      router.refresh();
    });
  }

  function fieldError(name: string): string | undefined {
    return fieldErrors[name]?.[0];
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">{labels.fields.name}</Label>
          <Input
            id="name"
            name="name"
            required
            defaultValue={initial?.name}
            aria-invalid={!!fieldError("name")}
            onChange={() => setDirty(true)}
            // Phase 14.3 — autofocus name on create pages so users
            // can immediately start typing without clicking first.
            autoFocus={!initial}
          />
          {fieldError("name") ? (
            <p className="text-xs text-destructive">{fieldError("name")}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="code">
            {labels.fields.code}
            <span className="ml-0.5 text-destructive" aria-hidden>
              *
            </span>
          </Label>
          <Input
            id="code"
            name="code"
            required
            defaultValue={initial?.code}
            aria-invalid={!!fieldError("code")}
          />
          <p className="text-xs text-muted-foreground">{labels.fields.codeHelp}</p>
          {fieldError("code") ? (
            <p className="text-xs text-destructive">{fieldError("code")}</p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">{labels.fields.address}</Label>
        <Input id="address" name="address" defaultValue={initial?.address ?? ""} />
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="city">{labels.fields.city}</Label>
          <Input id="city" name="city" defaultValue={initial?.city ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="region">{labels.fields.region}</Label>
          <Input id="region" name="region" defaultValue={initial?.region ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="country">{labels.fields.country}</Label>
          <Input id="country" name="country" defaultValue={initial?.country ?? ""} />
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-md border p-4">
        <Checkbox
          id="isDefault"
          checked={isDefault}
          onCheckedChange={(value) => setIsDefault(value === true)}
        />
        <div className="space-y-1 leading-none">
          <Label htmlFor="isDefault" className="cursor-pointer">
            {labels.fields.isDefault}
          </Label>
          <p className="text-xs text-muted-foreground">{labels.fields.isDefaultHelp}</p>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-3 border-t pt-6">
        <Button variant="ghost" asChild>
          <Link href={labels.backHref}>{labels.common.cancel}</Link>
        </Button>
        <Button type="submit" disabled={isPending}>
          {mode === "create" ? labels.common.save : labels.common.saveChanges}
        </Button>
      </div>
    </form>
  );
}
