// Sprint 13 PR #2 — EmptyState migration pack 3 (3 sayfa)
// (UX/UI audit Apr-25 §B-7 follow-up).
//
// Sprint 12 PR #1 4 integrations panel'i `bare` mode ile migrate etmişti.
// Bu paket 3 daha standalone empty state migrate eder:
//   - kits/[id] (Package, bare — Card içinde)
//   - integrations/[slug] (RefreshCw — sync history)
//   - reports/scan-activity-client (ScanLine)
//
// EmptyState surface 33 → 40+ (Sprint 12 4 panel + Sprint 13 3 sayfa).

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

const MIGRATED: ReadonlyArray<{
  name: string;
  path: string;
  icon: string;
  bare: boolean;
}> = [
  {
    name: "kits/[id]",
    path: "src/app/(app)/kits/[id]/page.tsx",
    icon: "Package",
    bare: true,
  },
  {
    name: "integrations/[slug] (sync history)",
    path: "src/app/(app)/integrations/[slug]/page.tsx",
    icon: "RefreshCw",
    bare: false,
  },
  {
    name: "reports/scan-activity (client)",
    path: "src/app/(app)/reports/scan-activity/scan-activity-client.tsx",
    icon: "ScanLine",
    bare: false,
  },
];

function read(rel: string): string {
  return readFileSync(resolve(REPO_ROOT, rel), "utf8");
}

describe("Sprint 13 PR #2 §B-7 — EmptyState migration pack 3 (3 sayfa)", () => {
  for (const { name, path, icon, bare } of MIGRATED) {
    describe(name, () => {
      const src = read(path);

      it("imports EmptyState", () => {
        expect(src).toMatch(
          /import\s*\{[^}]*\bEmptyState\b[^}]*\}\s*from\s*["']@\/components\/ui\/empty-state["']/,
        );
      });

      it(`uses <EmptyState${bare ? " bare" : ""} icon={${icon}} ...>`, () => {
        if (bare) {
          expect(src).toMatch(/<EmptyState\s+bare\b/);
        }
        expect(src).toMatch(new RegExp(`icon=\\{${icon}\\}`));
      });

      it("no longer uses inline `py-12 text-center` placeholder", () => {
        // Pattern: <Card><CardContent className="py-12 text-center"> + <p>No ...</p>
        expect(src).not.toMatch(
          /<CardContent[^>]*py-12 text-center[^>]*>[\s\S]{0,160}<p[^>]*>No /,
        );
      });
    });
  }

  it("EmptyState surface coverage >= 38 (Sprint 11: 33 + Sprint 12: +4 + Sprint 13: +3 ≥ 38)", () => {
    let count = 0;
    for (const file of walk(APP_DIR)) {
      const content = readFileSync(file, "utf8");
      if (content.includes("EmptyState")) count++;
    }
    expect(count, `EmptyState importer file count = ${count}`).toBeGreaterThanOrEqual(38);
  });
});
