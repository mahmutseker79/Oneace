"use client";

// Audit v1.1 §5.21 — segment boundary for the (auth) route group.
// Login / signup / 2FA / password-reset failures shouldn't bubble to
// global-error (which pulls the user to a raw "something broke" card).
// Keeping them scoped lets us offer a recovery path back to /login.

import { SegmentError } from "@/components/errors/segment-error";

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <SegmentError
      error={error}
      reset={reset}
      segmentId="auth"
      title="Authentication hit an error"
      description="Your session wasn't completed. Try again, or head back to sign in."
      recoveryLinks={[
        { label: "Sign in", href: "/login" },
        { label: "Reset password", href: "/forgot-password" },
        { label: "Home", href: "/" },
      ]}
    />
  );
}
