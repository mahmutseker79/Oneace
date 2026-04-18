"use client";

// Audit v1.1 §5.21 — segment boundary for /integrations.
// QuickBooks, Shopify, and future third-party OAuth flows hit external
// APIs that can fail in ways we don't fully control (rate limits,
// expired tokens, upstream outages). Scoping the boundary here means
// a Shopify blip doesn't bring down the whole app shell.

import { SegmentError } from "@/components/errors/segment-error";

export default function IntegrationsError({
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
      segmentId="integrations"
      title="Integration request failed"
      description="A third-party call didn't complete. Retry in a moment, or return to the integrations list."
      recoveryLinks={[
        { label: "Integrations", href: "/integrations" },
        { label: "Settings", href: "/settings" },
        { label: "Dashboard", href: "/dashboard" },
      ]}
    />
  );
}
