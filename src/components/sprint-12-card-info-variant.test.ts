// Sprint 12 PR #3 — Card `info` variant
// (UX/UI audit Apr-25 §C-3 follow-up).
//
// Sprint 10 PR #3'te Card primitive 4 variant ile geldi (default | interactive |
// warning | destructive). Sprint 12 PR #3 5. variant ekliyor: `info`
// (mavi tonlu notice/bilgi states için, --info / --info-light tokens kullanır).
//
// Storybook story `Info` da eklendi.
//
// Sprint 13+ migration: 14+ "info"-tipi alert/banner pattern'i bu variant'a
// çekilebilir — ama önce mevcut kullanımları audit etmek gerek (sonraki sprint).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..");

function read(relative: string): string {
  return readFileSync(resolve(REPO_ROOT, relative), "utf8");
}

describe("Sprint 12 PR #3 §C-3 — Card info variant", () => {
  describe("card.tsx primitive", () => {
    const src = read("src/components/ui/card.tsx");

    it("CARD_VARIANTS map includes `info`", () => {
      expect(src).toMatch(/info:\s*"border-info\/50 bg-info-light"/);
    });

    it("CardVariant union covers info", () => {
      // The type is `keyof typeof CARD_VARIANTS`, so adding info to the map
      // automatically extends the type. Just assert the source still uses the
      // keyof inference (defensive — protects against breaking refactors).
      expect(src).toMatch(/export type CardVariant = keyof typeof CARD_VARIANTS/);
    });
  });

  describe("card.stories.tsx", () => {
    const src = read("src/components/ui/card.stories.tsx");

    it("exports an `Info` story using variant=\"info\"", () => {
      expect(src).toContain("export const Info: Story");
      expect(src).toContain('variant="info"');
    });
  });

  describe("globals.css token wiring", () => {
    const src = read("src/app/globals.css");

    it("declares --info color (light mode)", () => {
      expect(src).toMatch(/--info:\s*#[0-9a-fA-F]+/);
    });

    it("declares --info-light color (light mode)", () => {
      expect(src).toMatch(/--info-light:\s*/);
    });

    it("registers --color-info-foreground for tailwind utility class wiring", () => {
      expect(src).toMatch(/--color-info-foreground:/);
    });
  });
});
