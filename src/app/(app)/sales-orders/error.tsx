"use client";

// Audit v1.1 §5.21 — segment boundary for /sales-orders.
// Sales order allocation is multi-step and touches stock reservations;
// a mid-flow crash should give users a clear retry path inside the
// sales-orders area, not dump them on the global error screen.

import { SegmentError } from "@/components/errors/segment-error";

export default function SalesOrdersError({
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
      segmentId="sales-orders"
      title="Sales order action failed"
      description="No allocation was partially committed. Retry the request, or return to the orders list."
      recoveryLinks={[
        { label: "Sales orders", href: "/sales-orders" },
        { label: "Picks", href: "/picks" },
        { label: "Inventory", href: "/inventory" },
        { label: "Dashboard", href: "/dashboard" },
      ]}
    />
  );
}
