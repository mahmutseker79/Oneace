"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { resolveSafeRedirect } from "@/lib/redirects";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

type RegisterFormLabels = {
  name: string;
  namePlaceholder: string;
  organization: string;
  organizationPlaceholder: string;
  email: string;
  emailPlaceholder: string;
  password: string;
  passwordPlaceholder: string;
  submit: string;
  error: string;
  orgError: string;
  terms: string;
  termsLink: string;
  and: string;
  privacyLink: string;
  termsSuffix: string;
  /** Shown under the name field when the user is registering in
   * response to an invitation — they will join the inviter's org
   * instead of creating their own. */
  inviteeNotice: string;
};

type RegisterFormProps = {
  labels: RegisterFormLabels;
};

export function RegisterForm({ labels }: RegisterFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Sprint 33: honor `?next=` on register the same way login does.
  // When the next target is an invite URL, we know the user is
  // joining an existing org — so we hide the org-name input and
  // skip the onboarding POST. Post-signup we push them to the
  // invite page, which will see them authenticated and enable the
  // accept button.
  const nextParam = searchParams.get("next") ?? searchParams.get("redirect");
  const redirectTo = resolveSafeRedirect(nextParam, "/items");
  const isInviteFlow = redirectTo.startsWith("/invite/");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const { error: signUpError, data } = await authClient.signUp.email({
        email,
        password,
        name,
      });
      if (signUpError) {
        setError(signUpError.message ?? labels.error);
        return;
      }

      // Sprint 33: only create a new org for the non-invite flow.
      // Invitees hand off to the invite page, which will create the
      // membership via `acceptInvitationAction`.
      if (data?.user && !isInviteFlow) {
        const res = await fetch("/api/onboarding/organization", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: organizationName }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { message?: string };
          setError(body.message ?? labels.orgError);
          return;
        }
      }

      router.push(redirectTo);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">{labels.name}</Label>
        <Input
          id="name"
          type="text"
          placeholder={labels.namePlaceholder}
          autoComplete="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      {isInviteFlow ? (
        <p
          className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
          role="note"
        >
          {labels.inviteeNotice}
        </p>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="organization">{labels.organization}</Label>
          <Input
            id="organization"
            type="text"
            placeholder={labels.organizationPlaceholder}
            required
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
          />
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="email">{labels.email}</Label>
        <Input
          id="email"
          type="email"
          placeholder={labels.emailPlaceholder}
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">{labels.password}</Label>
        <Input
          id="password"
          type="password"
          placeholder={labels.passwordPlaceholder}
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {labels.submit}
      </Button>
      <p className="text-xs text-muted-foreground text-center">
        {labels.terms}{" "}
        <a href="/legal/terms" className="underline">
          {labels.termsLink}
        </a>{" "}
        {labels.and}{" "}
        <a href="/legal/privacy" className="underline">
          {labels.privacyLink}
        </a>
        {labels.termsSuffix}
      </p>
    </form>
  );
}
