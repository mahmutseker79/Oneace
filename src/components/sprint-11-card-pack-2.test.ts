// Sprint 11 PR #1 — Card variant pack 2 (7 ad-hoc kullanım migrate)
// (UX/UI audit Apr-25 §C-3 follow-up).
//
// Sprint 10 PR #3 6 dosyayı migrate etmişti. Bu paket kalan 7'yi:

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..");

function read(relative: string): string {
  return readFileSync(resolve(REPO_ROOT, relative), "utf8");
}

const CASES: ReadonlyArray<{
  name: string;
  path: string;
  expectedVariant: "warning" | "destructive";
  forbiddenSubstring: string;
}> = [
  {
    name: "settings/general/settings-form",
    path: "src/app/(app)/settings/general/settings-form.tsx",
    expectedVariant: "destructive",
    forbiddenSubstring: 'border-destructive/20 bg-destructive/5',
  },
  {
    name: "settings/danger-zone-card",
    path: "src/app/(app)/settings/danger-zone-card.tsx",
    expectedVariant: "destructive",
    forbiddenSubstring: 'border-destructive/50 lg:col-span-2"',
  },
  {
    name: "settings/transfer-ownership-card",
    path: "src/app/(app)/settings/transfer-ownership-card.tsx",
    expectedVariant: "warning",
    forbiddenSubstring: 'border-warning/50 lg:col-span-2"',
  },
  {
    name: "migrations/new",
    path: "src/app/(app)/migrations/new/page.tsx",
    expectedVariant: "destructive",
    forbiddenSubstring: 'border-destructive/50 bg-destructive/5',
  },
  {
    name: "migrations/[id]",
    path: "src/app/(app)/migrations/[id]/page.tsx",
    expectedVariant: "destructive",
    forbiddenSubstring: '"border-destructive/50"',
  },
  {
    name: "transfers/[id]/add-line",
    path: "src/app/(app)/transfers/[id]/add-line/page.tsx",
    expectedVariant: "warning",
    forbiddenSubstring: 'border-warning/20 bg-warning-light',
  },
  {
    name: "ui/upgrade-prompt",
    path: "src/components/ui/upgrade-prompt.tsx",
    expectedVariant: "warning",
    forbiddenSubstring: 'border-warning/60 bg-warning-light',
  },
];

describe("Sprint 11 PR #1 §C-3 — Card variant pack 2 (7 ad-hoc → variant)", () => {
  for (const { name, path, expectedVariant, forbiddenSubstring } of CASES) {
    describe(name, () => {
      const src = read(path);

      it(`uses variant="${expectedVariant}"`, () => {
        expect(src).toContain(`variant="${expectedVariant}"`);
      });

      it("no longer contains the old raw className", () => {
        expect(src).not.toContain(forbiddenSubstring);
      });
    });
  }
});
