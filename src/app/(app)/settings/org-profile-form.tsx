"use client";

import { useState, useTransition } from "react";

import { useUnsavedWarning } from "@/hooks/use-unsaved-warning";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { updateOrganizationProfileAction } from "./actions";

export type OrgProfileFormLabels = {
  nameLabel: string;
  namePlaceholder: string;
  slugLabel: string;
  slugHelp: string;
  planLabel: string;
  save: string;
  saved: string;
};

type OrgProfileFormProps = {
  labels: OrgProfileFormLabels;
  initial: { name: string; slug: string; plan: string };
  canEdit: boolean;
  forbiddenLabel: string;
};

export function OrgProfileForm({ labels, initial, canEdit, forbiddenLabel }: OrgProfileFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(initial.slug);
  const { reset: resetUnsaved, setDirty } = useUnsavedWarning();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) return;
    setError(null);
    setFieldErrors({});
    setSuccess(false);
    const formData = new FormData();
    formData.set("name", name);
    formData.set("slug", slug);
    startTransition(async () => {
      const result = await updateOrganizationProfileAction(formData);
      if (!result.ok) {
        setError(result.error);
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        return;
      }
      setSuccess(true);
      resetUnsaved();
    });
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-1.5">
        <Label htmlFor="org-name">{labels.nameLabel}</Label>
        <Input
          id="org-name"
          name="name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setDirty(true);
          }}
          placeholder={labels.namePlaceholder}
          disabled={!canEdit || isPending}
          required
        />
        {fieldErrors.name?.[0] ? (
          <p className="text-xs text-destructive">{fieldErrors.name[0]}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="org-slug">{labels.slugLabel}</Label>
        <Input
          id="org-slug"
          name="slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          disabled={!canEdit || isPending}
          required
        />
        <p className="text-xs text-muted-foreground">{labels.slugHelp}</p>
        {fieldErrors.slug?.[0] ? (
          <p className="text-xs text-destructive">{fieldErrors.slug[0]}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label>{labels.planLabel}</Label>
        <p className="text-sm font-medium">{initial.plan}</p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-600">{labels.saved}</p> : null}
      {!canEdit ? <p className="text-xs text-muted-foreground">{forbiddenLabel}</p> : null}

      <Button type="submit" disabled={!canEdit || isPending}>
        {labels.save}
      </Button>
    </form>
  );
}
