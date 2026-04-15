"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";

import { createOrganizationAction } from "@/app/(app)/organizations/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CreateOrgFormLabels = {
  nameLabel: string;
  namePlaceholder: string;
  submit: string;
  creating: string;
  cancel: string;
  fallbackError: string;
};

type CreateOrgFormProps = {
  labels: CreateOrgFormLabels;
};

/**
 * Client form for creating an additional organization. On success we
 * push to `/dashboard` and call `router.refresh()` so the header
 * switcher picks up the new membership. We don't rely on the server
 * action's revalidatePath alone because the form lives under the
 * same layout that already rendered — the refresh is what forces
 * the layout to re-run with the new active-org cookie.
 */
export function CreateOrgForm({ labels }: CreateOrgFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (trimmed.length === 0) return;

    startTransition(async () => {
      const result = await createOrganizationAction(trimmed);
      if (!result.ok) {
        setError(result.error || labels.fallbackError);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="organization-name" className="sr-only">
          {labels.nameLabel}
        </Label>
        <Input
          id="organization-name"
          type="text"
          name="name"
          required
          minLength={2}
          maxLength={80}
          placeholder={labels.namePlaceholder}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          disabled={isPending}
        />
      </div>

      {error ? (
        <div
          role="alert"
          className="border-destructive/50 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
        >
          {error}
        </div>
      ) : null}

      <Button type="submit" className="w-full" disabled={isPending || name.trim().length < 2}>
        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {isPending ? labels.creating : labels.submit}
      </Button>
    </form>
  );
}
