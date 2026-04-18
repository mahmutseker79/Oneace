"use client";

// Audit v1.1 §5.21 — segment boundary for the (marketing) route group.
// Docs / landing pages / pricing live here; a crash on /docs shouldn't
// drop the visitor at a blank global error. This keeps the marketing
// shell's header & footer available so they can navigate elsewhere.

import { SegmentError } from "@/components/errors/segment-error";

export default function MarketingError({
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
      segmentId="marketing"
      title="This page couldn't load"
      description="The rest of the site still works. Jump to a known-good page or retry."
      recoveryLinks={[
        { label: "Home", href: "/" },
        { label: "Docs", href: "/docs" },
        { label: "Sign in", href: "/login" },
      ]}
    />
  );
}
