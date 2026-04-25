// Sprint 14 PR #1 — EmptyState migration pack 4 (5 surface, 4 dosya)
// (UX/UI audit Apr-25 §B-7 follow-up).
//
// EmptyState surface 40 → 44 file (5 inline pattern); items/import-form
// 2 farklı tab içeriği (ready + rejected) tek dosyada.
//
// Migrate edilen pattern'ler:
//   - stock-counts/compare (Search, bare, variant=filtered) — table empty
//   - transfers/[id] (Boxes, bare) — Card içinde lines empty
//   - stock-counts/[id]/rollback (Lock, variant=unavailable) — permission denied
//   - stock-counts/page.tsx renderTable (ClipboardList, bare) — generic empty helper
//   - items/import/import-form (CheckCircle2 + AlertTriangle, variant=filtered) — 2 tab

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

function read(rel: string): string {
  return readFileSync(resolve(REPO_ROOT, rel), "utf8");
}

const SURFACES: ReadonlyArray<{
  name: string;
  path: string;
  contains: ReadonlyArray<string>;
}> = [
  {
    name: "stock-counts/compare",
    path: "src/app/(app)/stock-counts/compare/page.tsx",
    contains: ["icon={Search}", 'title="No items in common"'],
  },
  {
    name: "transfers/[id]",
    path: "src/app/(app)/transfers/[id]/page.tsx",
    contains: ["icon={Boxes}", 'title="No lines added yet"'],
  },
  {
    name: "stock-counts/[id]/rollback",
    path: "src/app/(app)/stock-counts/[id]/rollback/page.tsx",
    contains: ["icon={Lock}", 'variant="unavailable"'],
  },
  {
    name: "stock-counts/page.tsx (renderTable helper)",
    path: "src/app/(app)/stock-counts/page.tsx",
    contains: ["icon={ClipboardList}", "title={emptyLabel}"],
  },
  {
    name: "items/import/import-form (ready + rejected tabs)",
    path: "src/app/(app)/items/import/import-form.tsx",
    contains: ["icon={CheckCircle2}", "icon={AlertTriangle}"],
  },
];

describe("Sprint 14 PR #1 §B-7 — EmptyState migration pack 4 (5 surface)", () => {
  for (const { name, path, contains } of SURFACES) {
    describe(name, () => {
      const src = read(path);

      it("imports EmptyState", () => {
        expect(src).toMatch(
          /import\s*\{[^}]*\bEmptyState\b[^}]*\}\s*from\s*["']@\/components\/ui\/empty-state["']/,
        );
      });

      for (const needle of contains) {
        it(`contains \`${needle}\``, () => {
          expect(src).toContain(needle);
        });
      }
    });
  }

  it("EmptyState file count >= 43 (Sprint 13: 40 + Sprint 14: +3-4 file)", () => {
    let count = 0;
    for (const file of walk(APP_DIR)) {
      const content = readFileSync(file, "utf8");
      if (content.includes("EmptyState")) count++;
    }
    expect(count, `EmptyState importer file count = ${count}`).toBeGreaterThanOrEqual(43);
  });
});
