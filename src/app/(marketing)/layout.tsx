/**
 * Marketing layout — shared shell for public-facing pages:
 * pricing (/pricing), docs (/docs).
 *
 * The root landing page (/) uses these components directly from
 * src/app/page.tsx since Next.js root pages can't use a nested layout.
 */

import { MarketingFooter } from "@/components/marketing/footer";
import { MarketingNav } from "@/components/marketing/nav";
import { getMessages } from "@/lib/i18n";

// Sprint 1 PR #5 (UX/UI audit Apr-25 §B-5): server async so the
// skip-link label flows from the i18n catalog (was hardcoded EN).
export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const t = await getMessages();
  return (
    <div className="flex min-h-screen flex-col">
      {/*
        Audit v1.1 §5.25 — skip-to-main link for keyboard users.
        Mirrors the `(app)` layout's pattern so the same target id
        (`main-content`) and Tailwind utility chain work across both
        shells. `sr-only` keeps it invisible until focused; the
        `focus:not-sr-only` flip reveals it fixed-top-left.

        Sprint 1 PR #5 §B-5: label resolved via `t.common.skipToMain`
        so the marketing shell is locale-aware (TR + future locales).
      */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:shadow-lg"
      >
        {t.common.skipToMain}
      </a>
      <MarketingNav />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <MarketingFooter />
    </div>
  );
}
