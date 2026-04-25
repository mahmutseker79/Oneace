// Sprint 1 PR #6 — KVKK marketing page uses semantic tokens, not raw
// Tailwind palette (UX/UI audit Apr-25 §B-7).
//
// Pre-PR the draft banner used `bg-yellow-50 border-yellow-300
// text-yellow-900`. The codebase already had a `<Alert variant=
// "warning">` primitive that wires the same warning intent through
// `--warning`/`--warning-light`/`--warning-foreground` tokens. The
// raw classes worked visually but bypassed the token system, so a
// brand colour change would skip this banner.
//
// This test is the only place in src/(marketing)/legal/ that should
// hold the line — the lint pattern is intentionally scoped to KVKK
// because terms / privacy pages may legitimately need other
// non-semantic palette use we don't want to over-restrict.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..", "..", "..");
const KVKK = readFileSync(
  resolve(REPO_ROOT, "src/app/(marketing)/legal/kvkk/page.tsx"),
  "utf8",
);

describe("PR #6 §B-7 — KVKK page uses semantic tokens, not raw Tailwind palette", () => {
  it("does not use bg/border/text-{color}-{shade} raw palette classes", () => {
    // The full Tailwind palette regex catches a future regression
    // where someone reaches for `bg-amber-100` etc.
    const palette = /\b(bg|border|text|ring)-(green|amber|emerald|red|blue|indigo|orange|yellow|rose|pink|cyan|teal|lime|fuchsia|purple|violet)-(50|100|200|300|400|500|600|700|800|900)\b/;
    expect(KVKK).not.toMatch(palette);
  });

  it("uses the canonical Alert primitive for the draft banner", () => {
    expect(KVKK).toMatch(/<Alert\s+variant="warning"/);
  });

  it("imports Alert / AlertDescription / AlertTitle from the design system", () => {
    expect(KVKK).toMatch(/from\s+["']@\/components\/ui\/alert["']/);
  });
});
