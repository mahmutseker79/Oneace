"use client";

// Sprint 37: Route-segment error boundary for the authenticated app.
//
// This file catches errors thrown by any page inside the `(app)`
// route group — items, warehouses, stock counts, scan, reports,
// purchase orders, audit, settings, users, dashboard. Unlike
// `global-error.tsx`, this boundary renders *inside* the app
// layout, so the sidebar and header stay intact. The user sees
// "this page failed, rest of the app is fine" rather than a
// full-window crash screen.
//
// Why a segment boundary and not just the global one: most errors
// we've hit during the port so far have been in page-level data
// fetching (Prisma queries, missing membership, invalid query
// params). Those are recoverable — a retry via `reset()` often
// works and the shell around them is still valid React. Only
// layout crashes should escalate to global-error.
//
// Copy-free for now: we use the i18n catalog via a hook rather
// than async server loading, so this client component gets the
// same translations as the rest of the app without duplicating
// strings. If i18n itself is what crashed, the global boundary
// handles it.

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

type AppErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

// Phase 13.2 — quick-navigation links so users can escape a crashed page
// without hunting the sidebar. Mirrors the pattern in not-found.tsx.
const NAV_LINKS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Items", href: "/items" },
  { label: "Warehouses", href: "/warehouses" },
  { label: "Stock counts", href: "/stock-counts" },
];

export default function AppError({ error, reset }: AppErrorProps) {
  useEffect(() => {
    // Send to Sentry for production visibility. captureException is a
    // no-op when NEXT_PUBLIC_SENTRY_DSN is unset (local dev / CI).
    captureException(error);
    // Client-side console breadcrumb for local dev triage.

    console.error("[app-error] route segment crashed", {
      digest: error.digest,
      message: error.message,
    });
  }, [error]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Something went wrong
          </p>
          <CardTitle>This page hit an unexpected error.</CardTitle>
          <CardDescription>
            The rest of the app is still usable. You can retry this page, or navigate to a working
            section below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {error.digest ? (
            <p className="font-mono text-xs text-muted-foreground">Ref: {error.digest}</p>
          ) : null}
          <div className="grid gap-1.5">
            {NAV_LINKS.map((link) => (
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
