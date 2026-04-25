// Sprint 12 PR #1 — EmptyState pack 2 (4 integrations panels) + bare prop
// (UX/UI audit Apr-25 §B-7 follow-up).
//
// Sprint 11 PR #3 standalone EmptyState pack 1 yapmıştı. Bu pack panel-içi
// (existing Card içinde) empty state'leri hedefliyor — `bare` prop ile.
//
// EmptyState primitive'e `bare?: boolean` prop eklendi:
//   - bare=false (default): outer Card border-dashed ile sarılır
//   - bare=true: sadece inner content (panel/CardContent içinde kullanım için)
//
// Migrate edilen 4 integrations panel:
//   - sync-rules-panel (Filter)
//   - webhook-events-panel (Webhook)
//   - sync-schedules-panel (Clock)
//   - field-mapping-table (ArrowRightLeft)

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..");

function read(relative: string): string {
  return readFileSync(resolve(REPO_ROOT, relative), "utf8");
}

describe("Sprint 12 PR #1 §B-7 — EmptyState bare prop + integrations pack 2", () => {
  describe("empty-state.tsx primitive", () => {
    const src = read("src/components/ui/empty-state.tsx");

    it("declares `bare?: boolean` prop", () => {
      expect(src).toMatch(/bare\?:\s*boolean/);
    });

    it("renders bare branch (no Card wrapper) when bare=true", () => {
      expect(src).toMatch(/if \(bare\)/);
      expect(src).toContain('data-bare="true"');
    });

    it("emits `data-slot=\"empty-state\"` on root for both modes", () => {
      const matches = src.match(/data-slot="empty-state"/g) ?? [];
      expect(matches.length).toBeGreaterThanOrEqual(2);
    });
  });

  const PANELS: ReadonlyArray<{ name: string; path: string; icon: string }> = [
    {
      name: "sync-rules-panel",
      path: "src/app/(app)/integrations/[slug]/sync-rules-panel.tsx",
      icon: "Filter",
    },
    {
      name: "webhook-events-panel",
      path: "src/app/(app)/integrations/[slug]/webhook-events-panel.tsx",
      icon: "Webhook",
    },
    {
      name: "sync-schedules-panel",
      path: "src/app/(app)/integrations/[slug]/sync-schedules-panel.tsx",
      icon: "Clock",
    },
    {
      name: "field-mapping-table",
      path: "src/app/(app)/integrations/[slug]/field-mapping-table.tsx",
      icon: "ArrowRightLeft",
    },
  ];

  for (const { name, path, icon } of PANELS) {
    describe(name, () => {
      const src = read(path);

      it("imports EmptyState", () => {
        expect(src).toMatch(
          /import\s*\{[^}]*\bEmptyState\b[^}]*\}\s*from\s*["']@\/components\/ui\/empty-state["']/,
        );
      });

      it("uses <EmptyState bare ...> pattern", () => {
        expect(src).toMatch(/<EmptyState\s+bare\b/);
      });

      it(`uses icon={${icon}}`, () => {
        expect(src).toMatch(new RegExp(`icon=\\{${icon}\\}`));
      });

      it("no longer uses inline `py-8 text-center` placeholder", () => {
        expect(src).not.toMatch(/<div className="py-8 text-center">\s*<p className="text-sm text-muted-foreground">No /);
      });
    });
  }
});
