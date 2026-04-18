"use client";

// Audit v1.1 §5.21 — shared segment-level error boundary UI.
//
// Why one shared component: in Next.js App Router each `error.tsx` must
// be a default-exported client component co-located with the segment.
// Duplicating the full card UI per segment was drift bait (styles drift,
// Sentry wiring drifts, retry wording drifts). This component keeps the
// shape fixed; the per-segment `error.tsx` files pass their own title,
// description, and recovery links.
//
// Why not a generic global fallback: segment errors should recover the
// user inside their current workflow. A PO crash should offer the PO
// list + dashboard, not just "try again". That's the whole reason we're
// adding segment-level boundaries in the first place.

import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { captureException } from "@/lib/sentry";

export type SegmentErrorLink = {
  label: string;
  href: string;
};

export type SegmentErrorProps = {
  /** Error object handed to us by Next.js App Router. */
  error: Error & { digest?: string };
  /** Retry function provided by the framework. */
  reset: () => void;
  /** Segment-specific headline (e.g., "Reports couldn't load"). */
  title: string;
  /** Segment-specific sub-copy explaining scope of failure. */
  description: string;
  /** Optional quick-recovery links; segment-specific routes. */
  recoveryLinks?: SegmentErrorLink[];
  /** Segment tag for breadcrumbs + Sentry scoping. */
  segmentId: string;
};

const DEFAULT_RECOVERY: SegmentErrorLink[] = [{ label: "Dashboard", href: "/dashboard" }];

export function SegmentError({
  error,
  reset,
  title,
  description,
  recoveryLinks = DEFAULT_RECOVERY,
  segmentId,
}: SegmentErrorProps) {
  useEffect(() => {
    captureException(error);

    console.error(`[segment-error:${segmentId}] crashed`, {
      digest: error.digest,
      message: error.message,
    });
  }, [error, segmentId]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Something went wrong
          </p>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {error.digest ? (
            <p className="font-mono text-xs text-muted-foreground">Ref: {error.digest}</p>
          ) : null}
          <div className="grid gap-1.5">
            {recoveryLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm font-medium hover:bg-accent/50 transition-colors"
              >
                {link.label}
                <span className="text-muted-foreground">→</span>
              </Link>
            ))}
          </div>
        </CardContent>
        <CardFooter className="gap-2 border-t pt-4">
          <Button type="button" onClick={() => reset()}>
            Try again
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
