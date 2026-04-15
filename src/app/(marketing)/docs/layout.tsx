/**
 * Docs section layout — shared sidebar + content area for all /docs/* pages.
 * The marketing layout (nav + footer) wraps this automatically.
 */

import Link from "next/link";

const DOC_LINKS = [
  { href: "/docs/getting-started", label: "Getting started" },
  { href: "/docs/scanning", label: "Barcode scanning" },
  { href: "/docs/stock-counts", label: "Stock counts" },
  { href: "/docs/warehouses", label: "Warehouses & bins" },
  { href: "/docs/purchase-orders", label: "Purchase orders" },
  { href: "/docs/reports", label: "Reports & exports" },
  { href: "/docs/permissions", label: "Team & permissions" },
];

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Sidebar */}
        <aside className="shrink-0 lg:w-52">
          <div className="sticky top-20 space-y-1">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Documentation
            </p>
            <Link
              href="/docs"
              className="block rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Overview
            </Link>
            {DOC_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </aside>

        {/* Content */}
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
