"use client";

// Phase 16 UX — AdvancedFeatureBanner.
//
// Shown on pages that are accessible but outside the primary workflow
// (Items → Locations → Stock Counts), e.g. Purchase Orders, Suppliers,
// Scan, Categories.
//
// Phase 1 UX improvement:
//   - Hidden for PRO and BUSINESS users (they're already unlocked; the
//     banner is noise for power users).
//   - Dismissable per-session for FREE users via localStorage.
//
// Server components pass `plan` so the server can short-circuit (return
// null) without hydration. The dismiss state is client-only (localStorage).

import { Info, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export type AdvancedFeatureBannerLabels = {
  label: string;
  body: string;
  cta: string;
};

const DISMISS_KEY = "oneace:banner:advanced-feature";

/**
 * Lightweight banner shown on advanced feature pages.
 * Hidden for PRO/BUSINESS users.
 * Dismissable per-session for FREE users.
 */
export function AdvancedFeatureBanner({
  labels,
  plan,
}: {
  labels: AdvancedFeatureBannerLabels;
  /** Current org plan. If PRO or BUSINESS, banner is hidden entirely. */
  plan?: "FREE" | "PRO" | "BUSINESS";
}) {
  const shouldDismiss = useMemo(() => {
    // Always hide for paid plans.
    if (plan === "PRO" || plan === "BUSINESS") return true;
    // Restore dismiss state from localStorage.
    const stored = localStorage.getItem(DISMISS_KEY);
    return stored === "1";
  }, [plan]);

  // Default true (hidden) to avoid flash-of-content on hydration.
  const [dismissed, setDismissed] = useState(shouldDismiss);

  if (dismissed) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  return (
    <Alert className="border-muted bg-muted/40">
      <Info className="h-4 w-4 text-muted-foreground" />
      <AlertTitle className="text-xs font-medium">{labels.label}</AlertTitle>
      <AlertDescription>
        <p>{labels.body}</p>
        <Link
          href="/items"
          className="mt-1 inline-block text-xs font-medium text-primary hover:underline"
        >
          {labels.cta} &rarr;
        </Link>
      </AlertDescription>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-3 top-3 rounded-sm text-muted-foreground opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </Alert>
  );
}
