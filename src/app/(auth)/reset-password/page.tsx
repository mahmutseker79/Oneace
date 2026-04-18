// God-Mode v2 §1.2 — password reset landing page.
//
// This is the page the user lands on when they click the link in the
// password-reset email that Better Auth sends. The email link carries
// a one-time `token` query param; the page reads it and, once the user
// submits a new password, calls `authClient.resetPassword({ token,
// newPassword })`.
//
// Pre-remediation this page did not exist at all — the forgot-password
// form's `redirectTo` pointed at `/auth/reset-password`, which 404'd.
// That broke the entire self-service password reset flow and forced
// users to email support. This page closes the loop.
//
// Public route: registered in `src/middleware.ts` PUBLIC_PATHS so an
// unauthenticated user (which by definition every password reset user
// is) can reach it without being redirected to /login.

import type { Metadata } from "next";
import Link from "next/link";

import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = {
  title: "Set a new password — OneAce",
};

type PageProps = {
  searchParams: Promise<{ token?: string | string[] }>;
};

export default async function ResetPasswordPage({ searchParams }: PageProps) {
  const resolved = await searchParams;
  const tokenParam = resolved?.token;
  // `searchParams` values can be arrays when the same key is repeated
  // in the query string. For reset links we only ever expect a single
  // value, so collapse defensively — but never throw, because we want
  // the page to render a friendly "invalid link" screen instead of a
  // server error.
  const token = typeof tokenParam === "string" ? tokenParam : tokenParam?.[0];

  if (!token) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Invalid reset link</h1>
          <p className="text-sm text-muted-foreground">
            This password reset link is missing its one-time token. Request a new reset email below.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Link
            href="/forgot-password"
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Request a new reset email
          </Link>
          <Link
            href="/login"
            className="inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium hover:bg-accent"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Set a new password</h1>
        <p className="text-sm text-muted-foreground">
          Choose a strong password you haven&apos;t used before. Minimum 8 characters.
        </p>
      </div>

      <ResetPasswordForm token={token} />

      <div className="text-center text-sm text-muted-foreground">
        Remembered your password?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </div>
    </div>
  );
}
