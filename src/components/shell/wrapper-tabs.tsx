"use client";

/**
 * v1.5 Navigation IA — Wrapper tab row.
 *
 * Each primary sidebar entry (Inventory, Locations, Counts, Orders,
 * Team, Settings) owns one or more re-homed sub-pages. Since the IA
 * refactor is zero-regression — sub-pages keep their real routes — a
 * thin tab row sits at the top of every wrapper page to make the
 * re-homed pages discoverable in-page.
 *
 * This is a **link-based** tab row, not Radix `Tabs`. Each tab is a
 * `<Link>` that fully navigates to the real page. That keeps server
 * components, data fetching, loading skeletons, and URL behaviour
 * untouched — all we add is visual grouping.
 *
 * Active-tab logic mirrors `isItemActive` in `./nav-config`:
 *   - exact href match or prefix match activates a tab
 *   - optional `activePrefixes` let a tab claim additional sub-routes
 *   - when several tabs would match (e.g. /items and a /items-only
 *     prefix), the most specific match wins via longest-prefix
 *     resolution
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export type WrapperTab = {
  /** Stable id for keys + analytics. */
  id: string;
  /** Human label (already i18n-resolved by the caller). */
  label: string;
  /** Where the tab navigates. */
  href: `/${string}`;
  /** Extra prefixes that also activate this tab. */
  activePrefixes?: readonly string[];
  /**
   * Optional badge shown to the right of the label — e.g. counts or
   * status markers. Callers can supply a pre-rendered string or node.
   */
  badge?: React.ReactNode;
};

function tabMatchLength(tab: WrapperTab, pathname: string): number {
  // `-1` means "no match"; otherwise we return the length of the
  // matching prefix so the caller can pick the longest.
  const candidates: string[] = [tab.href, ...(tab.activePrefixes ?? [])];
  let best = -1;
  for (const p of candidates) {
    if (pathname === p || pathname.startsWith(`${p}/`)) {
      if (p.length > best) best = p.length;
    }
  }
  return best;
}

export function WrapperTabs({
  tabs,
  ariaLabel,
  className,
}: {
  tabs: readonly WrapperTab[];
  /** Accessible name for the tab row, e.g. "Inventory sections". */
  ariaLabel: string;
  className?: string;
}) {
  const pathname = usePathname();

  // Longest-prefix wins. When no tab matches (e.g. a detail route that
  // isn't in the list), we don't highlight anything rather than guess.
  let activeId: string | null = null;
  let activeLength = -1;
  for (const tab of tabs) {
    const len = tabMatchLength(tab, pathname);
    if (len > activeLength) {
      activeLength = len;
      activeId = tab.id;
    }
  }

  return (
    <div className={cn("border-b border-border", className)}>
      <nav aria-label={ariaLabel} className="-mb-px flex gap-1 overflow-x-auto scrollbar-thin">
        {tabs.map((tab) => {
          const active = tab.id === activeId;
          return (
            <Link
              key={tab.id}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
              )}
            >
              <span>{tab.label}</span>
              {tab.badge ? (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground tabular-nums">
                  {tab.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
