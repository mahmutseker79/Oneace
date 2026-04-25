// Sprint 5 PR #1 — Storybook setup (UX/UI audit Apr-25 follow-up).
//
// Why Storybook now:
//   - 41 UI primitives in `src/components/ui` lack a single visual
//     contract surface. Card has 7 variants (KpiCard, ChartCard,
//     WidgetCard, DataPanel, SectionShell, ReportSummaryCard, plain
//     Card) — Storybook lets us see them side-by-side before
//     normalizing them in PR #2.
//   - Visual regression catches token-bypass regressions caught by
//     Sprint 1's lint guards but only after the fact. Storybook +
//     Chromatic / Playwright snapshots catch them at PR review.
//   - Accessibility addon (axe-core based) gives us a per-component
//     WCAG 2.1 AA report.
//
// Bağımlılık yüklemesi (Mahmut Mac'te yapacak):
//   pnpm install --save-dev \
//     @storybook/react@^8 @storybook/react-vite@^8 \
//     @storybook/addon-essentials@^8 @storybook/addon-a11y@^8 \
//     @storybook/test@^8 storybook@^8 vite@^5
//
// Sonra:
//   pnpm storybook         # http://localhost:6006
//   pnpm build-storybook   # production build
//
// Storybook çalıştırma scripts package.json'a Sprint 5 PR #1
// commit'inde eklendi.

import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: [
    "../src/components/**/*.stories.@(ts|tsx)",
    "../src/app/**/*.stories.@(ts|tsx)",
  ],
  addons: [
    "@storybook/addon-essentials",
    // a11y addon: live axe-core results per story. Aligns with
    // Sprint 4 PR #3 (axe-core CI for runtime pages).
    "@storybook/addon-a11y",
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  docs: {
    autodocs: "tag",
  },
  // Tailwind 4 + globals.css için preview.ts içinde import edilir.
  staticDirs: ["../public"],
};

export default config;
