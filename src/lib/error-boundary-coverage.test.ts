// P1-§5.21 (audit v1.1) — segment-level error boundary coverage.
//
// Problem at v1.0 close: only 2 error.tsx files existed
// (`app/global-error.tsx` + `app/(app)/error.tsx`). Any thrown error
// inside a deep route (e.g. /reports/inventory-on-hand) bubbled to the
// group-level boundary, which reset the URL and lost workflow context.
//
// This test pins the minimum set of route groups + high-risk segments
// that MUST carry their own error.tsx. Adding a new group or a new
// high-risk segment without a boundary now fails CI before merge.
//
// Static-analysis on purpose — we're guarding file existence and
// structural shape (is it a client component? does it default-export?
// does it delegate to the shared SegmentError?). Behavior is unit
// tested elsewhere via SegmentError's own surface.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const APP_DIR = resolve(__dirname, "..", "app");

// Each entry: path relative to src/app that MUST have an error.tsx.
// Grouped semantically so a future audit can add tiers without editing the
// test body — just extend the list.
const REQUIRED_BOUNDARIES: Array<{ path: string; reason: string }> = [
  // Root + route groups
  { path: "global-error.tsx", reason: "root boundary (layout crashes)" },
  { path: "(app)/error.tsx", reason: "authenticated shell fallback" },
  { path: "(auth)/error.tsx", reason: "login/signup/2FA flows" },
  { path: "(marketing)/error.tsx", reason: "public pages (docs/pricing)" },
  // High-risk (app) segments
  { path: "(app)/reports/error.tsx", reason: "18 report pages, per-query risk" },
  { path: "(app)/integrations/error.tsx", reason: "third-party API dependence" },
  { path: "(app)/purchase-orders/error.tsx", reason: "multi-step money flows" },
  { path: "(app)/sales-orders/error.tsx", reason: "stock allocation flows" },
  { path: "(app)/migrations/error.tsx", reason: "long-running wizard state" },
];

function readErrorBoundary(relPath: string): string | null {
  const full = resolve(APP_DIR, relPath);
  return existsSync(full) ? readFileSync(full, "utf8") : null;
}

describe("Error boundary coverage (audit v1.1 §5.21)", () => {
  for (const { path, reason } of REQUIRED_BOUNDARIES) {
    it(`${path} exists (${reason})`, () => {
      const contents = readErrorBoundary(path);
      expect(contents, `${path} missing — ${reason}`).not.toBeNull();
    });

    // global-error.tsx is its own thing (must wrap <html><body>), skip
    // shared-UI checks for it. Everything else should delegate to
    // SegmentError so we don't drift across 8 hand-rolled cards.
    if (path === "global-error.tsx") continue;

    it(`${path} is a client component`, () => {
      const contents = readErrorBoundary(path) ?? "";
      expect(contents, `${path} is not marked "use client"`).toMatch(/^["']use client["'];?/);
    });

    it(`${path} default-exports an error handler taking { error, reset }`, () => {
      const contents = readErrorBoundary(path) ?? "";
      expect(contents, `${path} missing default export`).toMatch(/export default function \w+/);
      expect(contents, `${path} doesn't destructure error/reset`).toMatch(/\berror\s*,\s*reset\b/);
    });

    it(`${path} delegates to SegmentError (shared UI)`, () => {
      const contents = readErrorBoundary(path) ?? "";
      expect(contents, `${path} doesn't import SegmentError`).toMatch(
        /from ["']@\/components\/errors\/segment-error["']/,
      );
      expect(contents, `${path} doesn't render <SegmentError>`).toMatch(/<SegmentError\b/);
      expect(contents, `${path} doesn't pass segmentId`).toMatch(/\bsegmentId=/);
    });
  }

  it("SegmentError component wires Sentry + client console breadcrumb", () => {
    const src = readFileSync(
      resolve(__dirname, "..", "components", "errors", "segment-error.tsx"),
      "utf8",
    );
    expect(src, "SegmentError must route to Sentry").toMatch(/\bcaptureException\(error\)/);
    expect(src, "SegmentError must breadcrumb to console for dev").toMatch(
      /console\.error\(`\[segment-error:/,
    );
    expect(src, "SegmentError must call reset() on retry").toMatch(
      /onClick=\{\(\)\s*=>\s*reset\(\)\}/,
    );
  });
});
