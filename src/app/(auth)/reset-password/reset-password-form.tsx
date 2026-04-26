"use client";

// God-Mode v2 §1.2 — reset-password form.
//
// Collects a new password (with confirm) and calls Better Auth's
// `resetPassword` endpoint with the one-time token the server included
// in the email link. Success → redirect to /login with a flag so the
// login page can render a "your password was updated" confirmation.
//
// Security notes:
//   - The token is treated as untrusted: we pass it straight through
//     to the server, which validates it. The form never stores it in
//     localStorage.
//   - Password length is enforced both client-side (UX) and server-
//     side (Better Auth `minPasswordLength`).
//   - Generic error copy — we never reveal whether a token is invalid
//     vs. expired to prevent enumeration.

import { authClient } from "@/lib/auth-client";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MIN_PASSWORD_LENGTH = 8;

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await (
          authClient as {
            resetPassword?: (opts: {
              newPassword: string;
              token: string;
            }) => Promise<{ error?: { message?: string } | null }>;
          }
        ).resetPassword?.({ newPassword: password, token });

        if (result?.error) {
          // Expired / reused / malformed tokens all end up here. Don't
          // leak which — the user just needs to request another link.
          setError(
            "This reset link is no longer valid. Please request a new reset email and try again.",
          );
          return;
        }

        router.push("/login?reset=success");
      } catch {
        setError(
          "Something went wrong updating your password. Please request a new reset email and try again.",
        );
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="new-password">New password</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          minLength={MIN_PASSWORD_LENGTH}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          // Sprint 30 — Input.state.success activation: visual confirmation when
          // the new password meets the length policy. Synchronous client check;
          // server still authoritative on actual reset.
          state={password.length >= MIN_PASSWORD_LENGTH ? "success" : "default"}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm-password">Confirm new password</Label>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          placeholder="Re-enter your new password"
          minLength={MIN_PASSWORD_LENGTH}
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          // Sprint 30 — Input.state.success activation.
          // Sprint 32 — live-validation error: kullanıcı yeterli uzunlukta
          // yazdıktan sonra mismatch varsa anında error feedback. Default
          // length < MIN iken kalır (henüz yazılıyor).
          //   - length < MIN  → default (yazılıyor, geri bildirim yok)
          //   - length >= MIN + match     → success
          //   - length >= MIN + mismatch  → error (LIVE-VALIDATION)
          state={
            confirm.length < MIN_PASSWORD_LENGTH
              ? "default"
              : confirm === password
                ? "success"
                : "error"
          }
        />
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        className="w-full"
        disabled={isPending || password.length === 0 || confirm.length === 0}
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Update password
      </Button>
    </form>
  );
}
