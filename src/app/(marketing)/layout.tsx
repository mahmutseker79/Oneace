/**
 * Marketing layout — shared shell for public-facing pages:
 * pricing (/pricing), docs (/docs).
 *
 * The root landing page (/) uses these components directly from
 * src/app/page.tsx since Next.js root pages can't use a nested layout.
 */

import { MarketingFooter } from "@/components/marketing/footer";
import { MarketingNav } from "@/components/marketing/nav";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <MarketingNav />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
