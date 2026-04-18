"use client";

// Audit v1.1 §5.21 — segment boundary for /migrations.
// Migration wizard is the longest-lived flow in the app (sometimes
// hours of CSV processing). A crash shouldn't drop the user at the
// app-level boundary; it should let them resume inside migrations.

import { SegmentError } from "@/components/errors/segment-error";

export default function MigrationsError({
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
      segmentId="migrations"
      title="Migration step hit an error"
      description="Your in-progress migration is preserved. Retry the step, or check the migration list."
      recoveryLinks={[
        { label: "Migrations", href: "/migrations" },
        { label: "Import", href: "/import" },
        { label: "Settings", href: "/settings" },
        { label: "Dashboard", href: "/dashboard" },
      ]}
    />
  );
}
