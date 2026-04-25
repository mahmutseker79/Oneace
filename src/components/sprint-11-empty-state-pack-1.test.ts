// Sprint 11 PR #3 — EmptyState migration pack 1 (4 sayfa)
// (UX/UI audit Apr-25 §B-7 follow-up).
//
// Önceki: 29 sayfa EmptyState kullanıyordu, ~30+ sayfa hâlâ manuel
// `<Card><CardContent><p className="text-center text-muted-foreground">No ...</p>`
// pattern'i kullanıyordu.
//
// Sprint 11 PR #3 pack 1 — 4 sayfa migrate (29→33). Pattern: ait olduğu
// route'a uygun lucide icon + standart CTA (varsa).
//
// Migrate edilenler:
//   - stock-counts/pending-approvals (CheckCircle2, no CTA)
//   - stock-counts/templates (ListChecks, "New Template" CTA capability'e bağlı)
//   - stock-counts/[id]/assignments (Users, no CTA)
//   - stock-counts/[id]/approval (FileSearch, no CTA)
//
// Sprint 12+ pack 2 hedefi: integrations/[slug]/* panel'leri (sync-rules,
// webhook-events, sync-schedules, field-mapping) + reports.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..");
const APP_DIR = resolve(REPO_ROOT, "src/app");

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      yield* walk(full);
    } else if (entry.endsWith(".tsx")) {
      yield full;
    }
  }
}

const MIGRATED: ReadonlyArray<{ name: string; path: string; icon: string }> = [
  {
    name: "stock-counts/pending-approvals",
    path: "src/app/(app)/stock-counts/pending-approvals/page.tsx",
    icon: "CheckCircle2",
  },
  {
    name: "stock-counts/templates",
    path: "src/app/(app)/stock-counts/templates/page.tsx",
    icon: "ListChecks",
  },
  {
    name: "stock-counts/[id]/assignments",
    path: "src/app/(app)/stock-counts/[id]/assignments/page.tsx",
    icon: "Users",
  },
  {
    name: "stock-counts/[id]/approval",
    path: "src/app/(app)/stock-counts/[id]/approval/page.tsx",
    icon: "FileSearch",
  },
];

function read(rel: string): string {
  return readFileSync(resolve(REPO_ROOT, rel), "utf8");
}

describe("Sprint 11 PR #3 §B-7 — EmptyState migration pack 1 (4 sayfa)", () => {
  for (const { name, path, icon } of MIGRATED) {
    describe(name, () => {
      const src = read(path);

      it("imports EmptyState from the design system", () => {
        expect(src).toMatch(
          /import\s*\{[^}]*\bEmptyState\b[^}]*\}\s*from\s*["']@\/components\/ui\/empty-state["']/,
        );
      });

      it(`uses <EmptyState icon={${icon}} ...>`, () => {
        expect(src).toMatch(/<EmptyState\s/);
        expect(src).toMatch(new RegExp(`icon=\\{${icon}\\}`));
      });

      it("no longer uses the inline `<p text-center text-muted-foreground>No ...</p>` Card pattern", () => {
        expect(src).not.toMatch(
          /<Card[^>]*>\s*<CardContent[^>]*>\s*<p className="text-center text-muted-foreground">No /,
        );
      });
    });
  }

  it("EmptyState surface coverage >= 33 (Sprint 10: 29 + Sprint 11 pack 1: +4)", () => {
    let count = 0;
    for (const file of walk(APP_DIR)) {
      const content = readFileSync(file, "utf8");
      if (content.includes("EmptyState")) count++;
    }
    expect(count, `EmptyState importer page count = ${count}`).toBeGreaterThanOrEqual(33);
  });
});
