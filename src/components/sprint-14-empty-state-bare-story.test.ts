// Sprint 14 PR #3 — EmptyState bare story (UX/UI audit Apr-25 §B-7 follow-up).
//
// Sprint 12 PR #1 EmptyState primitive'e `bare` prop eklemişti ama Storybook
// story'si yoktu. Sprint 14 PR #3 onu ekler.
//
// NOT: Bu dosya başlangıçta informational inline-pattern audit'i de içeriyordu
// (threshold ≤10). Sprint 15 PR #2 onu daha geniş hard-fail guard'a taşıdı:
// `empty-state-no-inline-pattern.test.ts`. Burada sadece Bare story checks kaldı.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..");

function read(rel: string): string {
  return readFileSync(resolve(REPO_ROOT, rel), "utf8");
}

describe("Sprint 14 PR #3 §B-7 — EmptyState Bare story", () => {
  describe("empty-state.stories.tsx", () => {
    const src = read("src/components/ui/empty-state.stories.tsx");

    it("exports a `Bare` story", () => {
      expect(src).toContain("export const Bare: Story");
    });

    it("Bare story sets `bare: true`", () => {
      expect(src).toMatch(/Bare:\s*Story\s*=\s*\{[\s\S]{0,400}bare:\s*true/);
    });

    it("Bare story has docs.description.story explanation", () => {
      expect(src).toContain('docs:');
      expect(src).toContain('panel-içi');
    });
  });
});
