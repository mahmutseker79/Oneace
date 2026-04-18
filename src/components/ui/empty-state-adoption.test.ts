/**
 * P3-2 (audit v1.0 §9.2) — pin which page-level list screens have
 * adopted the `<EmptyState>` primitive so a careless refactor
 * can't slip a bare `<p>No records yet</p>` back in.
 *
 * The audit flagged `/items` as a fresh empty state that renders a
 * bare table header — it has since been fixed, and most of the
 * other major list pages use the primitive too. This test locks
 * the coverage in so later additions must either:
 *
 *   (a) adopt `<EmptyState>` themselves, or
 *   (b) explicitly remove the page from this allowlist, documenting
 *       the reason in the PR that does it.
 *
 * It is deliberately NOT an exhaustive `(app)` recursive scan:
 * settings sub-pages, import flows, and report surfaces have
 * their own presentation rules (forms, wizards, or chart-first
 * layouts) and asking every one of them to render an EmptyState
 * would be cargo-culted. The list below is the canonical
 * "things the user came here to see a list of" surfaces.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Each entry: page path and the exact import line we expect.
// Using the literal import line rather than just grepping for the
// identifier catches the sneaky "imported but not rendered" case.
const LIST_PAGES: Array<{ path: string; label: string }> = [
  { path: "src/app/(app)/items/page.tsx", label: "items" },
  { path: "src/app/(app)/suppliers/page.tsx", label: "suppliers" },
  { path: "src/app/(app)/warehouses/page.tsx", label: "warehouses" },
  { path: "src/app/(app)/categories/page.tsx", label: "categories" },
  { path: "src/app/(app)/purchase-orders/page.tsx", label: "purchase-orders" },
  { path: "src/app/(app)/movements/page.tsx", label: "movements" },
  { path: "src/app/(app)/transfers/page.tsx", label: "transfers" },
  { path: "src/app/(app)/stock-counts/page.tsx", label: "stock-counts" },
  // P3-2 — newly adopted.
  { path: "src/app/(app)/departments/page.tsx", label: "departments" },
];

function readSrc(relative: string): string {
  return readFileSync(join(process.cwd(), relative), "utf8");
}

describe("EmptyState adoption on page-level list screens (§9.2)", () => {
  it.each(LIST_PAGES)("$label page imports EmptyState from the canonical primitive", ({ path }) => {
    const source = readSrc(path);
    expect(source).toMatch(/from\s+"@\/components\/ui\/empty-state"/);
  });

  it.each(LIST_PAGES)("$label page renders <EmptyState> at least once", ({ path }) => {
    const source = readSrc(path);
    // Matches either `<EmptyState ...>` or the self-closing form.
    expect(source).toMatch(/<EmptyState[\s\n]/);
  });

  it("does not re-introduce the 'No <thing> yet' bare banner on departments", () => {
    // This was the exact string the pre-P3-2 departments page
    // rendered instead of an EmptyState. Keeping it here as a
    // direct regression fence.
    const source = readSrc("src/app/(app)/departments/page.tsx");
    expect(source).not.toMatch(/<p[^>]*>\s*No departments yet\s*<\/p>/);
  });
});
