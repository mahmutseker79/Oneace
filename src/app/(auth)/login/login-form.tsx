"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { resolveSafeRedirect } from "@/lib/redirects";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

type LoginFormLabels = {
  email: string;
  emailPlaceholder: string;
  password: string;
  passwordPlaceholder: string;
  submit: string;
  error: string;
};

type LoginFormProps = {
  labels: LoginFormLabels;
};

export function LoginForm({ labels }: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Sprint 33: accept `?next=` primarily (new canonical name) and
  // fall back to `?redirect=` for the pre-Sprint-33 callers. Both
  // are validated via `resolveSafeRedirect` to block open-redirect
  // attacks like `?next=https://evil.example`.
  const nextParam = searchParams.get("next") ?? searchParams.get("redirect");
  const redirectTo = resolveSafeRedirect(nextParam, "/dashboard");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const { error: signInError } = await authClient.signIn.email({
        email,
        password,
        callbackURL: redirectTo,
      });
      if (signInError) {
        setError(signInError.message ?? labels.error);
        return;
      }
      router.push(redirectTo);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
        <div className="flex items-center justify-between">
          <Label htmlFor="password">{labels.password}</Label>
          <a
            href="mailto:hello@oneace.app?subject=Password+Reset+Request"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Forgot password?
          </a>
        </div>
        <Input
          id="password"
          type="password"
          placeholder={labels.passwordPlaceholder}
          autoComplete="current-password"
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
    </form>
  );
}
