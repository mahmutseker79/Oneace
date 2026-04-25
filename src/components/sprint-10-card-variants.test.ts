// Sprint 10 PR #3 — Card variant normalize
// (UX/UI audit Apr-25 §C-3 follow-up).
//
// Önceki: ad-hoc className kombinasyonları (7+ farklı stil):
//   - hover:bg-muted/50 cursor-pointer transition-colors  (×3)
//   - border-warning bg-warning-light                      (×2)
//   - border-destructive                                   (×1)
//   - border-warning/50, border-destructive/50, vs.        (×6+)
// Yeni: 3 named variant + default. Source-level pin.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..");

function read(relative: string): string {
  return readFileSync(resolve(REPO_ROOT, relative), "utf8");
}

describe("Sprint 10 PR #3 §C-3 — Card variant normalize 7→3", () => {
  describe("card.tsx primitive", () => {
    const src = read("src/components/ui/card.tsx");

    it("exports CardVariant type", () => {
      expect(src).toMatch(/export type CardVariant/);
    });

    it("declares CARD_VARIANTS map with default + interactive + warning + destructive", () => {
      expect(src).toContain("default:");
      expect(src).toContain("interactive:");
      expect(src).toContain("warning:");
      expect(src).toContain("destructive:");
    });

    it("Card accepts a `variant` prop with default value 'default'", () => {
      expect(src).toMatch(/function Card\([^)]*variant\s*=\s*["']default["']/);
    });

    it("emits data-variant attribute for CSS / e2e selectors", () => {
      expect(src).toContain('data-variant={variant}');
    });
  });

  describe("migration coverage (3+3 ad-hoc → variant)", () => {
    it("departments/page.tsx uses variant='interactive' instead of inline className", () => {
      const src = read("src/app/(app)/departments/page.tsx");
      expect(src).toContain('<Card variant="interactive">');
      expect(src).not.toContain("hover:bg-muted/50 cursor-pointer transition-colors");
    });

    it("stock-counts/pending-approvals/page.tsx uses variant='interactive'", () => {
      const src = read("src/app/(app)/stock-counts/pending-approvals/page.tsx");
      expect(src).toContain('<Card variant="interactive">');
    });

    it("stock-counts/templates/page.tsx uses variant='interactive'", () => {
      const src = read("src/app/(app)/stock-counts/templates/page.tsx");
      expect(src).toContain('<Card variant="interactive">');
    });

    it("transfers/new/page.tsx uses variant='warning' instead of inline className", () => {
      const src = read("src/app/(app)/transfers/new/page.tsx");
      expect(src).toContain('<Card variant="warning">');
      expect(src).not.toContain('<Card className="border-warning bg-warning-light">');
    });

    it("transfers/[id]/receive/page.tsx uses variant='warning'", () => {
      const src = read("src/app/(app)/transfers/[id]/receive/page.tsx");
      expect(src).toContain('<Card variant="warning">');
    });

    it("settings/privacy/page.tsx uses variant='destructive' instead of inline className", () => {
      const src = read("src/app/(app)/settings/privacy/page.tsx");
      expect(src).toContain('<Card variant="destructive">');
      expect(src).not.toContain('<Card className="border-destructive">');
    });
  });
});
