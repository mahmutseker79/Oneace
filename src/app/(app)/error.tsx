"use client";

// Sprint 37 introduced this segment boundary for the authenticated shell;
// audit v1.1 §5.21 refactored it to delegate to the shared SegmentError
// component so all segment boundaries stay in sync (Sentry wiring, copy,
// retry UX).

import { SegmentError } from "@/components/errors/segment-error";

export default function AppError({
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
      segmentId="app"
      title="This page hit an unexpected error."
      description="The rest of the app is still usable. You can retry this page, or navigate to a working section below."
      recoveryLinks={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Items", href: "/items" },
        { label: "Warehouses", href: "/warehouses" },
        { label: "Stock counts", href: "/stock-counts" },
      ]}
    />
  );
}
