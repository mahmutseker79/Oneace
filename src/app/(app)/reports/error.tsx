"use client";

// Audit v1.1 §5.21 — segment boundary for /reports.
// 18 report pages, each with its own Prisma query graph; we've seen
// per-report crashes from bad date filters and missing enums. This
// boundary keeps the sidebar + report nav intact so the user can
// pick a different report instead of reloading the whole app.

import { SegmentError } from "@/components/errors/segment-error";

export default function ReportsError({
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
      segmentId="reports"
      title="This report couldn't load"
      description="Other reports still work. Try again, pick a different one, or check the filters."
      recoveryLinks={[
        { label: "Reports home", href: "/reports" },
        { label: "Inventory on-hand", href: "/reports/inventory-on-hand" },
        { label: "Dashboard", href: "/dashboard" },
      ]}
    />
  );
}
