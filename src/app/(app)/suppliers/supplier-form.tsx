"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { useUnsavedWarning } from "@/hooks/use-unsaved-warning";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Supplier } from "@/generated/prisma";

import { createSupplierAction, updateSupplierAction } from "./actions";

export type SupplierFormLabels = {
  fields: {
    name: string;
    code: string;
    codeHelp: string;
    contactName: string;
    email: string;
    phone: string;
    website: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    region: string;
    postalCode: string;
    country: string;
    currency: string;
    currencyHelp: string;
    notes: string;
    notesPlaceholder: string;
    isActive: string;
    isActiveHelp: string;
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

type SupplierFormProps = {
  labels: SupplierFormLabels;
  mode: "create" | "edit";
  initial?: Pick<
    Supplier,
    | "id"
    | "name"
    | "code"
    | "contactName"
    | "email"
    | "phone"
    | "website"
    | "addressLine1"
    | "addressLine2"
    | "city"
    | "region"
    | "postalCode"
    | "country"
    | "currency"
    | "notes"
    | "isActive"
  >;
};

export function SupplierForm({ labels, mode, initial }: SupplierFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [isActive, setIsActive] = useState<boolean>(initial?.isActive ?? true);
  const { reset: resetUnsaved, setDirty } = useUnsavedWarning();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    const formData = new FormData(event.currentTarget);
    formData.set("isActive", isActive ? "true" : "false");

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createSupplierAction(formData)
          : await updateSupplierAction(initial?.id ?? "", formData);

      if (!result.ok) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      resetUnsaved();
      router.push("/suppliers");
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
            defaultValue={initial?.name ?? ""}
            aria-invalid={!!fieldError("name")}
            onChange={() => setDirty(true)}
            // Phase 14.3 — autofocus name on create pages.
            autoFocus={!initial}
          />
          {fieldError("name") ? (
            <p className="text-xs text-destructive">{fieldError("name")}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="code">
            {labels.fields.code}{" "}
            <span className="text-xs text-muted-foreground">({labels.common.optional})</span>
          </Label>
          <Input id="code" name="code" defaultValue={initial?.code ?? ""} />
          <p className="text-xs text-muted-foreground">{labels.fields.codeHelp}</p>
          {fieldError("code") ? (
            <p className="text-xs text-destructive">{fieldError("code")}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="contactName">
            {labels.fields.contactName}{" "}
            <span className="text-xs text-muted-foreground">({labels.common.optional})</span>
          </Label>
          <Input id="contactName" name="contactName" defaultValue={initial?.contactName ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">
            {labels.fields.email}{" "}
            <span className="text-xs text-muted-foreground">({labels.common.optional})</span>
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={initial?.email ?? ""}
            aria-invalid={!!fieldError("email")}
          />
          {fieldError("email") ? (
            <p className="text-xs text-destructive">{fieldError("email")}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="phone">
            {labels.fields.phone}{" "}
            <span className="text-xs text-muted-foreground">({labels.common.optional})</span>
          </Label>
          <Input id="phone" name="phone" defaultValue={initial?.phone ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="website">
            {labels.fields.website}{" "}
            <span className="text-xs text-muted-foreground">({labels.common.optional})</span>
          </Label>
          <Input
            id="website"
            name="website"
            type="url"
            defaultValue={initial?.website ?? ""}
            aria-invalid={!!fieldError("website")}
          />
          {fieldError("website") ? (
            <p className="text-xs text-destructive">{fieldError("website")}</p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="addressLine1">
          {labels.fields.addressLine1}{" "}
          <span className="text-xs text-muted-foreground">({labels.common.optional})</span>
        </Label>
        <Input id="addressLine1" name="addressLine1" defaultValue={initial?.addressLine1 ?? ""} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="addressLine2">
          {labels.fields.addressLine2}{" "}
          <span className="text-xs text-muted-foreground">({labels.common.optional})</span>
        </Label>
        <Input id="addressLine2" name="addressLine2" defaultValue={initial?.addressLine2 ?? ""} />
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="city">{labels.fields.city}</Label>
          <Input id="city" name="city" defaultValue={initial?.city ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="region">{labels.fields.region}</Label>
          <Input id="region" name="region" defaultValue={initial?.region ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="postalCode">{labels.fields.postalCode}</Label>
          <Input id="postalCode" name="postalCode" defaultValue={initial?.postalCode ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="country">{labels.fields.country}</Label>
          <Input id="country" name="country" defaultValue={initial?.country ?? ""} />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="currency">{labels.fields.currency}</Label>
          <Input
            id="currency"
            name="currency"
            defaultValue={initial?.currency ?? "USD"}
            maxLength={3}
            aria-invalid={!!fieldError("currency")}
          />
          <p className="text-xs text-muted-foreground">{labels.fields.currencyHelp}</p>
          {fieldError("currency") ? (
            <p className="text-xs text-destructive">{fieldError("currency")}</p>
          ) : null}
        </div>
        <div className="flex items-start gap-3 rounded-md border p-4">
          <Checkbox
            id="isActive"
            checked={isActive}
            onCheckedChange={(value) => setIsActive(value === true)}
          />
          <div className="space-y-1 leading-none">
            <Label htmlFor="isActive" className="cursor-pointer">
              {labels.fields.isActive}
            </Label>
            <p className="text-xs text-muted-foreground">{labels.fields.isActiveHelp}</p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">
          {labels.fields.notes}{" "}
          <span className="text-xs text-muted-foreground">({labels.common.optional})</span>
        </Label>
        <Textarea
          id="notes"
          name="notes"
          rows={4}
          defaultValue={initial?.notes ?? ""}
          placeholder={labels.fields.notesPlaceholder}
        />
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
