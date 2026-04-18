"use client";

// Audit v1.1 §5.21 — segment boundary for /purchase-orders.
// PO receive / allocate flows touch inventory + money + supplier data;
// crashes mid-workflow are stressful. Scoped boundary gives users a
// retry that keeps them in the PO area rather than kicking them out.

import { SegmentError } from "@/components/errors/segment-error";

export default function PurchaseOrdersError({
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
      segmentId="purchase-orders"
      title="Purchase order action failed"
      description="Your data is safe — nothing was partially saved. Retry, or return to the PO list."
      recoveryLinks={[
        { label: "Purchase orders", href: "/purchase-orders" },
        { label: "Suppliers", href: "/suppliers" },
        { label: "Inventory", href: "/inventory" },
        { label: "Dashboard", href: "/dashboard" },
      ]}
    />
  );
}
