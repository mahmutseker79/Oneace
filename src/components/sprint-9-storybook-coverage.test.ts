// Sprint 9 PR #1 — Storybook primitive coverage
// (UX/UI audit Apr-25 §C-1 follow-up).
//
// Sprint 5 PR #1 Storybook 8 foundation kurdu (button + 1 story).
// Sprint 8 PR #1 10 primitive story ekledi (badge/alert/card/empty-state/
//   page-header/skeleton/input/kpi-card/tabs/tooltip).
// Sprint 9 PR #1 14 yeni primitive: select, label, textarea, checkbox, switch,
//   dialog, sheet, popover, dropdown-menu, avatar, breadcrumb, separator,
//   sonner, scroll-area.
//
// Toplam threshold: 25 story (Sprint 5: 1 + Sprint 8: 10 + Sprint 9: 14).
// Bu sayı düşerse test fail eder — Storybook foundation regression guard.

import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const UI_DIR = resolve(__dirname, "ui");

const REQUIRED_STORIES = [
  // Sprint 5 foundation
  "button.stories.tsx",
  // Sprint 8 PR #1 polish (10)
  "badge.stories.tsx",
  "alert.stories.tsx",
  "card.stories.tsx",
  "empty-state.stories.tsx",
  "page-header.stories.tsx",
  "skeleton.stories.tsx",
  "input.stories.tsx",
  "kpi-card.stories.tsx",
  "tabs.stories.tsx",
  "tooltip.stories.tsx",
  // Sprint 9 PR #1 (14)
  "select.stories.tsx",
  "label.stories.tsx",
  "textarea.stories.tsx",
  "checkbox.stories.tsx",
  "switch.stories.tsx",
  "dialog.stories.tsx",
  "sheet.stories.tsx",
  "popover.stories.tsx",
  "dropdown-menu.stories.tsx",
  "avatar.stories.tsx",
  "breadcrumb.stories.tsx",
  "separator.stories.tsx",
  "sonner.stories.tsx",
  "scroll-area.stories.tsx",
] as const;

describe("Sprint 9 PR #1 §C-1 — Storybook primitive coverage", () => {
  const present = new Set(readdirSync(UI_DIR).filter((f) => f.endsWith(".stories.tsx")));

  it("contains every required primitive story", () => {
    const missing = REQUIRED_STORIES.filter((s) => !present.has(s));
    expect(missing, `Eksik story dosyaları: ${missing.join(", ")}`).toEqual([]);
  });

  it("primitive story count >= 25 (Sprint 5: 1 + Sprint 8: 10 + Sprint 9: 14)", () => {
    expect(present.size).toBeGreaterThanOrEqual(25);
  });
});
