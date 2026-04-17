"use client";

// Phase 4.4 — Forgot password form.
//
// Calls Better Auth's forgetPassword endpoint if it's available.
// Falls back to a mailto: support link if password reset email isn't
// configured on the server (no RESEND_API_KEY or sendResetPassword hook).
//
// Security: We always show the same "Check your email" message regardless
// of whether the email exists in our system (prevents account enumeration).

import { authClient } from "@/lib/auth-client";
import { Loader2, Mail } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim()) return;

    startTransition(async () => {
      // Better Auth's forgetPassword sends a reset email when configured.
      // We call it best-effort — if the server doesn't have email reset
      // set up, the response will indicate that but we still show the same
      // confirmation message (anti-enumeration: never reveal whether an
      // account exists).
      try {
        await (
          authClient as {
            forgetPassword?: (opts: {
              email: string;
              redirectTo: string;
            }) => Promise<unknown>;
          }
        ).forgetPassword?.({
          email,
          redirectTo: `${window.location.origin}/auth/reset-password`,
        });
      } catch {
        // Swallow — the confirmation screen is shown regardless.
      }

      setSubmitted(true);
    });
  }

  if (submitted) {
    return (
      <div className="space-y-4 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <div className="space-y-1">
            <p className="font-medium">Check your inbox</p>
            <p className="text-sm text-muted-foreground">
              If an account exists for <strong>{email}</strong>, you&apos;ll receive a password
              reset link within a few minutes.
            </p>
          </div>
        </div>

        <div className="rounded-md border bg-muted/30 px-4 py-3 text-left text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Didn&apos;t receive an email?</p>
          <p className="mt-1">
            Check your spam folder, or{" "}
            <a
              href={`mailto:hello@oneace.app?subject=Password+Reset+Request&body=I+need+a+password+reset+for+the+account+registered+with+${encodeURIComponent(email)}`}
              className="font-medium text-primary hover:underline"
            >
              contact support
            </a>{" "}
            and we&apos;ll manually reset your account.
          </p>
        </div>

        <Button variant="outline" className="w-full" onClick={() => setSubmitted(false)}>
          Try a different email
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="reset-email">Email address</Label>
        <Input
          id="reset-email"
          type="email"
          placeholder="you@company.com"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <Button type="submit" className="w-full" disabled={isPending || !email.trim()}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Send reset link
      </Button>
    </form>
  );
}
