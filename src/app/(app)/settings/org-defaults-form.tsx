"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { updateOrgDefaultsAction } from "./actions";

/**
 * Sentinel value used to represent "no override — use the platform
 * default". We can't use an empty string as a Radix `<Select>` value
 * (the primitive disallows it to avoid collisions with the placeholder
 * state), so we pick an unused token and translate to "" in submit.
 */
const PLATFORM_DEFAULT = "__platform__";

export type OrgDefaultsFormLabels = {
  heading: string;
  description: string;
  helpText: string;
  localeLabel: string;
  regionLabel: string;
  platformDefault: string;
  save: string;
  saved: string;
  forbidden: string;
};

type OrgDefaultsFormProps = {
  labels: OrgDefaultsFormLabels;
  localeOptions: ReadonlyArray<{ code: string; label: string }>;
  regionOptions: ReadonlyArray<{ code: string; label: string }>;
  initial: { defaultLocale: string | null; defaultRegion: string | null };
  canEdit: boolean;
};

export function OrgDefaultsForm({
  labels,
  localeOptions,
  regionOptions,
  initial,
  canEdit,
}: OrgDefaultsFormProps) {
  const [isPending, startTransition] = useTransition();
  const [defaultLocale, setDefaultLocale] = useState<string>(
    initial.defaultLocale ?? PLATFORM_DEFAULT,
  );
  const [defaultRegion, setDefaultRegion] = useState<string>(
    initial.defaultRegion ?? PLATFORM_DEFAULT,
  );
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [success, setSuccess] = useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) return;
    setError(null);
    setFieldErrors({});
    setSuccess(false);

    const formData = new FormData();
    formData.set("defaultLocale", defaultLocale === PLATFORM_DEFAULT ? "" : defaultLocale);
    formData.set("defaultRegion", defaultRegion === PLATFORM_DEFAULT ? "" : defaultRegion);

    startTransition(async () => {
      const result = await updateOrgDefaultsAction(formData);
      if (!result.ok) {
        setError(result.error);
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        return;
      }
      setSuccess(true);
    });
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-1.5">
        <Label htmlFor="org-default-locale">{labels.localeLabel}</Label>
        <Select
          value={defaultLocale}
          onValueChange={setDefaultLocale}
          disabled={!canEdit || isPending}
        >
          <SelectTrigger id="org-default-locale" className="md:max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={PLATFORM_DEFAULT}>{labels.platformDefault}</SelectItem>
            {localeOptions.map((opt) => (
              <SelectItem key={opt.code} value={opt.code}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {fieldErrors.defaultLocale?.[0] ? (
          <p className="text-xs text-destructive">{fieldErrors.defaultLocale[0]}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="org-default-region">{labels.regionLabel}</Label>
        <Select
          value={defaultRegion}
          onValueChange={setDefaultRegion}
          disabled={!canEdit || isPending}
        >
          <SelectTrigger id="org-default-region" className="md:max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={PLATFORM_DEFAULT}>{labels.platformDefault}</SelectItem>
            {regionOptions.map((opt) => (
              <SelectItem key={opt.code} value={opt.code}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {fieldErrors.defaultRegion?.[0] ? (
          <p className="text-xs text-destructive">{fieldErrors.defaultRegion[0]}</p>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">{labels.helpText}</p>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {success ? <p className="text-sm text-success">{labels.saved}</p> : null}
      {!canEdit ? <p className="text-xs text-muted-foreground">{labels.forbidden}</p> : null}

      <Button type="submit" disabled={!canEdit || isPending}>
        {labels.save}
      </Button>
    </form>
  );
}
