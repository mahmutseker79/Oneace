// Sprint 1 PR #1 — `aria-current="page"` 3 navigation surface'inde
// (UX/UI audit Apr-25 §B-2).
//
// WCAG 2.1 AA SC 4.1.2 "Name, Role, Value" + WAI-ARIA Authoring Practices
// "current page" pattern: a navigation item that points to the currently
// rendered page should expose `aria-current="page"`. Prior to this PR
// only `wrapper-tabs.tsx` carried the attribute; sidebar, mobile-nav,
// and breadcrumb relied on a visual-only active state — screen reader
// users could navigate these surfaces without ever knowing which item
// represented the page they were on.
//
// Why a static test (over a JSDOM render): these are client components
// reading `usePathname()`, so a render-based test would need a Next.js
// router context, a path mock, and snapshots per matched/unmatched
// pair. The invariant we care about is "the active branch sets the
// attribute, the inactive branch must not" — that is a pure source
// pattern, observable with `readFileSync` + regex.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..", "..");

function read(relative: string): string {
  return readFileSync(resolve(REPO_ROOT, relative), "utf8");
}

const SIDEBAR = read("src/components/shell/sidebar.tsx");
const MOBILE_NAV = read("src/components/shell/mobile-nav.tsx");
const BREADCRUMB = read("src/components/ui/breadcrumb.tsx");
const WRAPPER_TABS = read("src/components/shell/wrapper-tabs.tsx");

describe("PR #1 §B-2 — sidebar exposes aria-current on the active route", () => {
  it("renders aria-current=\"page\" on the active item, omitted otherwise", () => {
    // The expression must read the active flag; the inactive branch
    // must collapse to `undefined` so React strips the attribute (we
    // do NOT want `aria-current="false"` — that confuses some screen
    // readers and is non-canonical).
    expect(SIDEBAR).toMatch(/aria-current=\{isActive \? "page" : undefined\}/);
  });

  it("does not emit a literal aria-current=\"false\"", () => {
    expect(SIDEBAR).not.toMatch(/aria-current=["']false["']/);
  });
});

describe("PR #1 §B-2 — mobile-nav exposes aria-current on the active route", () => {
  it("renders aria-current=\"page\" on the active item, omitted otherwise", () => {
    expect(MOBILE_NAV).toMatch(/aria-current=\{isActive \? "page" : undefined\}/);
  });

  it("does not emit a literal aria-current=\"false\"", () => {
    expect(MOBILE_NAV).not.toMatch(/aria-current=["']false["']/);
  });
});

describe("PR #1 §B-2 — breadcrumb marks the trailing item as the current page", () => {
  it("emits aria-current=\"page\" on the last (non-link) item", () => {
    // The trailing breadcrumb item is the page the user is on. WAI-ARIA
    // breadcrumb pattern: trailing item is span (not link) and gets
    // `aria-current="page"`.
    expect(BREADCRUMB).toMatch(/aria-current="page"/);
  });

  it("hides the chevron separator from screen readers", () => {
    // The chevron is decorative — without aria-hidden, NVDA reads
    // "right pointing chevron" between every breadcrumb item.
    expect(BREADCRUMB).toMatch(/<ChevronRight[\s\S]*?aria-hidden="true"/);
  });

  it("hides the \"...\" truncation from screen readers", () => {
    // The truncation marker is purely visual; reading "three dots"
    // adds noise without conveying meaning.
    expect(BREADCRUMB).toMatch(/<span aria-hidden="true"[^>]*>\s*\{item\.label\}/);
  });
});

describe("PR #1 §B-2 — wrapper-tabs (pre-existing aria-current) stays correct", () => {
  it("retains the canonical pattern", () => {
    // wrapper-tabs already carried this — verify we did not regress
    // it during the PR.
    expect(WRAPPER_TABS).toMatch(/aria-current=\{active \? "page" : undefined\}/);
  });
});
