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

type AppErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AppError({ error, reset }: AppErrorProps) {
  useEffect(() => {
    // Client-side console bread crumb. The server already logged
    // the same error via our structured logger (Next.js pipes
    // thrown server errors through React's error channel before
    // emitting them to stderr, which the logger picks up).
    // eslint-disable-next-line no-console
    console.error("[app-error] route segment crashed", {
      digest: error.digest,
      message: error.message,
    });
  }, [error]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Card className="max-w-lg">
        <CardHeader>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Something went wrong
          </p>
          <CardTitle>This page hit an unexpected error.</CardTitle>
          <CardDescription>
            The rest of the app is still usable. You can retry this page, or navigate away and come
            back.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error.digest ? (
            <p className="font-mono text-xs text-muted-foreground">Ref: {error.digest}</p>
          ) : null}
        </CardContent>
        <CardFooter className="gap-2">
          <Button type="button" onClick={() => reset()}>
            Try again
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
