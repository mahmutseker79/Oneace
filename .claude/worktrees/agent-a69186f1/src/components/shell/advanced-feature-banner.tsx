import { Info } from "lucide-react";
import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export type AdvancedFeatureBannerLabels = {
  label: string;
  body: string;
  cta: string;
};

/**
 * Lightweight banner shown on pages that are accessible but not part of the
 * primary simplified workflow (Items → Locations → Stock Counts).
 *
 * Non-blocking — it sits above the page content and does not prevent usage.
 */
export function AdvancedFeatureBanner({
  labels,
}: {
  labels: AdvancedFeatureBannerLabels;
}) {
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
    </Alert>
  );
}
