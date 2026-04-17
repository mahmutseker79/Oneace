// Phase 12.2 — Custom 404 not-found page.
// Shown when Next.js cannot match a route (app-level not-found.tsx).
// Provides helpful navigation links rather than a bare browser 404.

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found — OneAce",
};

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md space-y-6 text-center">
        <div className="space-y-2">
          <p className="font-mono text-6xl font-bold text-muted-foreground/30">404</p>
          <h1 className="text-2xl font-semibold">Page not found</h1>
          <p className="text-muted-foreground">
            This page doesn&apos;t exist or has been moved. Here are some places to start:
          </p>
        </div>

        <div className="grid gap-2">
          {[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Items", href: "/items" },
            { label: "Warehouses", href: "/warehouses" },
            { label: "Stock counts", href: "/stock-counts" },
            { label: "Movements", href: "/movements" },
            { label: "Settings", href: "/settings" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center justify-between rounded-md border px-4 py-2.5 text-sm font-medium hover:bg-accent/50 transition-colors"
            >
              {link.label}
              <span className="text-muted-foreground">→</span>
            </Link>
          ))}
        </div>

        <div className="pt-2">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
