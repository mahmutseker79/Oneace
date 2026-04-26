"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AnalyticsEvents } from "@/lib/analytics/events";
import { authClient } from "@/lib/auth-client";
import { track } from "@/lib/instrumentation";
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

/**
 * Phase 16.3 — Billing intent capture.
 *
 * The pricing page CTA sends users to `/register?plan=PRO&interval=year`.
 * We capture these params here and, after org creation, initiate checkout
 * immediately so the user's annual intent is not silently lost.
 *
 * Supported plans: PRO | BUSINESS
 * Supported intervals: month | year
 * Any other value is ignored (falls back to normal /items redirect).
 */
function parseBillingIntent(searchParams: ReturnType<typeof useSearchParams>): {
  plan: "PRO" | "BUSINESS";
  interval: "month" | "year";
} | null {
  const plan = searchParams.get("plan");
  const interval = searchParams.get("interval");
  if (plan !== "PRO" && plan !== "BUSINESS") return null;
  return { plan, interval: interval === "year" ? "year" : "month" };
}

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

  // Phase 16.3 — billing intent from query params (e.g. from pricing CTA).
  const billingIntent = parseBillingIntent(searchParams);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [orgNameError, setOrgNameError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setOrgNameError(null);

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

      // Audit v1.1 §5.20 — signup_completed fires once better-auth hands
      // back a user; before org creation so invite-flow signups count.
      track(AnalyticsEvents.SIGNUP_COMPLETED, {
        flow: isInviteFlow ? "invite" : "organic",
        hasBillingIntent: Boolean(billingIntent),
      });

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
          const body = (await res.json().catch(() => ({}))) as {
            message?: string;
            issues?: Array<{ path: string[]; message: string }>;
          };
          // Surface field-level errors (e.g. org name too short) on the
          // correct field rather than as a generic banner.
          const nameIssue = body.issues?.find((i) => i.path[0] === "name");
          if (nameIssue) {
            setOrgNameError(nameIssue.message);
          } else {
            setError(body.message ?? labels.orgError);
          }
          return;
        }

        // Phase 16.3 — billing intent: initiate checkout immediately after
        // org creation if the user came from a plan-specific pricing CTA.
        // This ensures annual intent is not silently lost between registration
        // and the billing settings page.
        if (billingIntent) {
          try {
            const checkoutRes = await fetch("/api/billing/checkout", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                plan: billingIntent.plan,
                interval: billingIntent.interval,
              }),
            });
            const checkoutData = (await checkoutRes.json().catch(() => ({}))) as {
              url?: string;
            };
            if (checkoutData.url) {
              // Redirect directly to Stripe checkout — skips /items entirely.
              window.location.href = checkoutData.url;
              return;
            }
          } catch {
            // Checkout initiation failed (Stripe not configured, network error,
            // etc.) — fall through to normal /items redirect. The user will
            // land on /settings/billing where they can upgrade manually.
          }
          // Checkout failed or returned no URL — fall through to billing settings
          // with a hint so the user can complete the upgrade.
          router.push(
            `/settings/billing?plan=${billingIntent.plan}&interval=${billingIntent.interval}`,
          );
          router.refresh();
          return;
        }
      }

      router.push(redirectTo);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Phase 2 — billing intent context banner.
          Shown when user arrives from a plan-specific pricing CTA so they
          know their plan selection is remembered and will be acted on. */}
      {billingIntent && !isInviteFlow ? (
        <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2.5 text-sm">
          <span className="font-medium">
            {billingIntent.plan} {billingIntent.interval === "year" ? "Annual" : "Monthly"}
          </span>{" "}
          plan selected — after account creation you&apos;ll be taken directly to checkout.
        </div>
      ) : null}

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
            aria-invalid={!!orgNameError}
            value={organizationName}
            onChange={(e) => {
              setOrganizationName(e.target.value);
              if (orgNameError) setOrgNameError(null);
            }}
          />
          {orgNameError ? (
            <p className="text-xs text-destructive" role="alert">
              {orgNameError}
            </p>
          ) : null}
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
          // Sprint 30 — Input.state.success activation: visual confirmation
          // when the new password meets the 8-char minimum. Lock-step with
          // reset-password-form. Server still authoritative on the actual
          // create-account call.
          state={password.length >= 8 ? "success" : "default"}
        />
        <p className="text-xs text-muted-foreground">At least 8 characters</p>
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
      <p className="text-center text-xs text-muted-foreground">
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
