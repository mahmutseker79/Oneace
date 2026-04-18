// v1.2 P2 §5.38 — DR drill evidence freshness guard.
//
// `docs/backup-strategy.md` has long promised RTO ≤ 4 hours / RPO ≤ 1
// hour. Those numbers are meaningless without a periodic drill that
// actually restores a production backup into a disposable environment
// and measures elapsed time. §5.38 introduced:
//
//   1. `docs/DR-drill-log.md`                 — the append-only ledger
//   2. `.github/workflows/dr-drill.yml`       — the scheduled workflow
//   3. this test                              — the freshness guard
//
// This test pins the presence + shape of (1) and (2), and in local
// development also checks that the most recent real drill is not
// stale. In CI we only enforce shape checks — we don't want a
// months-without-drill state to wedge the pipeline; that signal
// belongs on a calendar, not on `main`. Local runs emit a soft
// warning via `console.warn` when stale.
//
// Intentionally static-analysis only: no Neon API call, no Git
// history read, no Prisma. Matches the rest of the audit-remediation
// pin style (§5.17, §5.29, §5.32, §5.36, §5.37).

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..");
const DRILL_LOG_PATH = join(REPO_ROOT, "docs", "DR-drill-log.md");
const WORKFLOW_PATH = join(REPO_ROOT, ".github", "workflows", "dr-drill.yml");

// Staleness budget for local dev. In practice we aim for monthly
// drills, but the window here is 90 days — tight enough to surface
// drift when nobody's run one in a quarter, loose enough that a
// month-over-month gap doesn't spam warnings.
const STALENESS_DAYS = 90;

// Shape contract ---------------------------------------------------------

describe("DR drill evidence — files exist", () => {
  it("`docs/DR-drill-log.md` exists", () => {
    expect(
      existsSync(DRILL_LOG_PATH),
      "DR drill log missing — restore docs/DR-drill-log.md; it's the canonical RTO/RPO evidence ledger",
    ).toBe(true);
  });

  it("`.github/workflows/dr-drill.yml` exists", () => {
    expect(
      existsSync(WORKFLOW_PATH),
      "DR drill workflow missing — restore .github/workflows/dr-drill.yml so monthly drills can be scheduled",
    ).toBe(true);
  });
});

// Drill log format contract ---------------------------------------------

describe("DR drill log — format contract", () => {
  const src = readFileSync(DRILL_LOG_PATH, "utf8");

  it("carries the top-level title so the doc is discoverable", () => {
    expect(src).toMatch(/^# OneAce Disaster Recovery — Drill Log/m);
  });

  it("contains at least one entry — real-dated OR explicit TABLETOP", () => {
    // Real entries start with `## YYYY-MM-DD —`; tabletop entries
    // start with `## TABLETOP —`. Either form keeps the ledger alive.
    const realEntry = /^##\s+\d{4}-\d{2}-\d{2}\s+—\s+/m;
    const tabletop = /^##\s+TABLETOP\s+—\s+/m;
    expect(
      realEntry.test(src) || tabletop.test(src),
      "DR drill log has no entries — at minimum a TABLETOP row must anchor the file so the freshness guard has something to parse",
    ).toBe(true);
  });

  it("documents the 9-step procedure inline so on-call can run it without hunting", () => {
    // The audit's ask was not just "log" but "runbook next to log".
    // We pin the presence of a handful of load-bearing procedure
    // tokens rather than the exact prose — this keeps future edits
    // flexible without letting the runbook silently vanish.
    const tokens = ["Neon branch", "prisma migrate deploy", "vitest run", "RTO", "RPO"];
    for (const token of tokens) {
      expect(src, `procedure token missing from DR drill log: ${token}`).toContain(token);
    }
  });
});

// Workflow skeleton contract --------------------------------------------

describe("DR drill workflow — skeleton contract", () => {
  const src = readFileSync(WORKFLOW_PATH, "utf8");

  it("names the workflow `DR Drill` so it's discoverable in the Actions tab", () => {
    expect(src).toMatch(/^name:\s*DR Drill/m);
  });

  it("is wired to BOTH workflow_dispatch and schedule (monthly cadence)", () => {
    expect(src, "workflow_dispatch trigger missing — operator needs a manual entry point").toMatch(
      /workflow_dispatch:/,
    );
    expect(src, "schedule trigger missing — the whole point of §5.38 is monthly evidence").toMatch(
      /schedule:/,
    );
    expect(src, "schedule cron missing — schedule: without a cron entry is dead").toMatch(
      /cron:\s*["'][^"']+["']/,
    );
  });

  it("defaults DRY_RUN=true so the first scheduled run can't surprise a prod Neon account", () => {
    // If someone flips the default to false before the first real
    // drill has been validated manually, they'll wake up to either a
    // surprise branch or a surprise bill. Pin the default.
    expect(src).toMatch(/default:\s*true/);
  });

  it("short-circuits when secrets aren't configured (never reds CI on a fresh fork)", () => {
    expect(src).toContain("secrets_missing");
  });
});

// Freshness guard -------------------------------------------------------
//
// Parses the most recent real drill date and, in local dev only,
// warns when it's older than STALENESS_DAYS. CI runs are intentionally
// ignored — a stale drill is an operational problem, not a build bug.

function mostRecentDrillDate(src: string): Date | null {
  const matches = [...src.matchAll(/^##\s+(\d{4}-\d{2}-\d{2})\s+—\s+/gm)];
  if (matches.length === 0) return null;
  const dates = matches
    .map((m) => new Date(`${m[1]}T00:00:00Z`))
    .filter((d) => !Number.isNaN(d.getTime()));
  if (dates.length === 0) return null;
  return dates.reduce((a, b) => (a.getTime() > b.getTime() ? a : b));
}

describe("DR drill — freshness (local-dev signal only)", () => {
  const src = readFileSync(DRILL_LOG_PATH, "utf8");
  const latest = mostRecentDrillDate(src);
  const isCI = process.env.CI === "true" || process.env.CI === "1";

  it(`warns when the last real drill is older than ${STALENESS_DAYS} days — soft-fail (CI exempt)`, () => {
    if (latest === null) {
      // Tabletop-only state: acceptable on day 1, noisy thereafter.
      // The test passes but we surface a warning locally so a dev
      // running vitest notices we're still in tabletop mode.
      if (!isCI) {
        console.warn(
          "[DR drill] log contains only TABLETOP entries — run the first live drill and append a dated row.",
        );
      }
      expect(true).toBe(true);
      return;
    }
    const ageDays = Math.floor((Date.now() - latest.getTime()) / (1000 * 60 * 60 * 24));
    if (ageDays > STALENESS_DAYS && !isCI) {
      console.warn(
        `[DR drill] last drill was ${ageDays} days ago (> ${STALENESS_DAYS}d budget). Time to re-run.`,
      );
    }
    // We never fail the assertion — the point is a nudge, not a
    // pipeline wedge. CI runs exit here with a pass regardless.
    expect(Number.isFinite(ageDays)).toBe(true);
  });
});
