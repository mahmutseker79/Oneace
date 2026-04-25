// Sprint 10 PR #1 — Tablet sidebar md:flex
// (UX/UI audit Apr-25 §B-1 follow-up).
//
// Önceki: sidebar `lg:flex` (1024px+) ile mobile arasında 768-1024
// (iPad portrait/landscape) sidebar görünmüyordu — kullanıcı her zaman
// hamburger menü açmak zorunda kalıyordu.
//
// Sprint 10 PR #1: breakpoint `lg:` → `md:` (≥768px). Sidebar tablet'te de
// görünür, hamburger butonu da `md:hidden` ile uyumlu.
//
// Etkilenen 3 dosya:
//   - src/components/shell/sidebar.tsx        (aside className)
//   - src/components/shell/header.tsx          (hamburger button hidden)
//   - src/app/(app)/layout.tsx                 (content padding)

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..");

function read(relative: string): string {
  return readFileSync(resolve(REPO_ROOT, relative), "utf8");
}

describe("Sprint 10 PR #1 §B-1 — Tablet sidebar md:flex", () => {
  describe("sidebar.tsx", () => {
    const src = read("src/components/shell/sidebar.tsx");

    it("uses md:flex (≥768px) instead of lg:flex (≥1024px)", () => {
      expect(src).toContain("md:flex");
      expect(src).toContain("md:w-64");
      expect(src).toContain("md:fixed");
    });

    it("does NOT use lg:flex for sidebar root", () => {
      expect(src).not.toMatch(/<aside[^>]*lg:flex/);
    });
  });

  describe("header.tsx", () => {
    const src = read("src/components/shell/header.tsx");

    it("hides hamburger button at md+ (matches sidebar breakpoint)", () => {
      expect(src).toContain("md:hidden");
      expect(src).not.toContain('className="lg:hidden"');
    });
  });

  describe("(app)/layout.tsx", () => {
    const src = read("src/app/(app)/layout.tsx");

    it("uses md:pl-64 to offset content for the sidebar", () => {
      expect(src).toContain("md:pl-64");
      expect(src).not.toContain("lg:pl-64");
    });
  });
});
