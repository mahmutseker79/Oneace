// Sprint 16 PR #1 — EmptyState `completed` variant + putaway visual restore
// (UX/UI audit Apr-25 §B-7 follow-up).
//
// Sprint 15 PR #1 putaway noUnbinnedStock surface'ini `empty` variant'a
// migrate etmişti — text-success → text-primary visual loss vardı.
// Sprint 16 PR #1 EmptyState'e `completed` variant ekler (success ring +
// green icon) ve putaway'i restore eder.
//
// Bu test:
//   1) EmptyStateVariant union'a "completed" girdi
//   2) Component "completed" branch'ini iconContainerClass + iconClass için handle ediyor
//   3) Storybook'a Completed story eklendi
//   4) putaway-form noUnbinnedStock variant="completed" kullanıyor

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..");

function read(rel: string): string {
  return readFileSync(resolve(REPO_ROOT, rel), "utf8");
}

describe("Sprint 16 PR #1 §B-7 — EmptyState `completed` variant", () => {
  describe("empty-state.tsx component", () => {
    const src = read("src/components/ui/empty-state.tsx");

    it("EmptyStateVariant union includes 'completed'", () => {
      expect(src).toMatch(
        /export\s+type\s+EmptyStateVariant\s*=[^;]*"completed"/,
      );
    });

    it("iconContainerClass handles completed variant (success ring)", () => {
      expect(src).toMatch(/variant\s*===\s*"completed"[\s\S]{0,80}bg-success\/10/);
    });

    it("iconClass handles completed variant (text-success)", () => {
      expect(src).toMatch(/variant\s*===\s*"completed"[\s\S]{0,80}text-success/);
    });
  });

  describe("empty-state.stories.tsx", () => {
    const src = read("src/components/ui/empty-state.stories.tsx");

    it("exports a `Completed` story", () => {
      expect(src).toContain("export const Completed: Story");
    });

    it("Completed story sets variant=\"completed\"", () => {
      expect(src).toMatch(/Completed:\s*Story\s*=\s*\{[\s\S]{0,400}variant:\s*"completed"/);
    });

    it("argTypes options includes completed", () => {
      expect(src).toMatch(/options:\s*\[[^\]]*"completed"/);
    });
  });

  describe("putaway-form noUnbinnedStock visual restore", () => {
    const src = read("src/app/(app)/purchase-orders/[id]/putaway/putaway-form.tsx");

    it("noUnbinnedStock branch uses variant=\"completed\"", () => {
      // Block: title={labels.noUnbinnedStock} ... variant="completed"
      expect(src).toMatch(
        /title=\{labels\.noUnbinnedStock\}[\s\S]{0,200}variant="completed"/,
      );
    });

    it("noUnbinnedStock branch retains CheckCircle2 icon", () => {
      expect(src).toMatch(
        /icon=\{CheckCircle2\}[\s\S]{0,200}title=\{labels\.noUnbinnedStock\}/,
      );
    });

    it("noUnbinnedStock branch keeps viewPo action", () => {
      expect(src).toMatch(
        /title=\{labels\.noUnbinnedStock\}[\s\S]{0,300}label:\s*labels\.viewPo/,
      );
    });
  });
});
