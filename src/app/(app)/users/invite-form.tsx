"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { inviteMemberAction } from "./actions";

export type InviteFormLabels = {
  emailLabel: string;
  emailPlaceholder: string;
  roleLabel: string;
  submit: string;
  success: string;
  roleOptions: Array<{ value: string; label: string }>;
};

type InviteFormProps = {
  labels: InviteFormLabels;
  defaultRole: string;
};

export function InviteForm({ labels, defaultRole }: InviteFormProps) {
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>(defaultRole);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setSuccess(false);
    const formData = new FormData();
    formData.set("email", email);
    formData.set("role", role);
    startTransition(async () => {
      const result = await inviteMemberAction(formData);
      if (!result.ok) {
        setError(result.error);
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        return;
      }
      setEmail("");
      setRole(defaultRole);
      setSuccess(true);
    });
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-[1fr_200px_auto] md:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="invite-email">{labels.emailLabel}</Label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={labels.emailPlaceholder}
            disabled={isPending}
            required
          />
          {fieldErrors.email?.[0] ? (
            <p className="text-xs text-destructive">{fieldErrors.email[0]}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="invite-role">{labels.roleLabel}</Label>
          <Select value={role} onValueChange={setRole} disabled={isPending}>
            <SelectTrigger id="invite-role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {labels.roleOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button type="submit" disabled={isPending}>
          {labels.submit}
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-600">{labels.success}</p> : null}
    </form>
  );
}
