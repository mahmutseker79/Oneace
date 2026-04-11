import { getMessages } from "@/lib/i18n";
import type { Metadata } from "next";
import Link from "next/link";

/**
 * Offline fallback page served by the service worker when a
 * navigation request fails (no network). Rendered at build time
 * as static HTML so the SW can precache it — that's why this page:
 *
 *   1. Doesn't call `requireSession` or any DB helper.
 *   2. Doesn't pull locale from a cookie (uses the platform default
 *      via getMessages(), which gracefully falls back when there's
 *      no request context).
 *   3. Doesn't render any client components.
 *
 * A signed-in user who loses connectivity will still see the app
 * shell from the router's last successful navigation; this page
 * is the "cold start while offline" landing spot.
 */
export const dynamic = "force-static";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return {
    title: t.offline.metaTitle,
    robots: { index: false, follow: false },
  };
}

export default async function OfflinePage() {
  const t = await getMessages();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="mx-auto max-w-md text-center">
        <div
          aria-hidden="true"
          className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-muted"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-8 w-8 text-muted-foreground"
          >
            <title>{t.offline.iconLabel}</title>
            <path d="M1 1l22 22" />
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
            <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
            <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
            <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
            <line x1="12" y1="20" x2="12.01" y2="20" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{t.offline.title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{t.offline.description}</p>
        <div className="mt-8 flex flex-col gap-3 text-sm">
          <Link
            href="/"
            className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            {t.offline.retryCta}
          </Link>
          <Link
            href="/offline/items"
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            {t.offline.viewCachedItemsCta}
          </Link>
          <p className="text-xs text-muted-foreground">{t.offline.tip}</p>
        </div>
      </div>
    </div>
  );
}
