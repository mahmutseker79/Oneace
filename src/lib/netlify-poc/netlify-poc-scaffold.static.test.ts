// Faz 1 Netlify POC pinned static-analysis test.
//
// WHY: The Netlify POC scaffold is spread across four surfaces
//   - netlify.toml           (build/runtime config)
//   - netlify/functions/*    (scheduled cron bridges)
//   - prisma/schema.prisma   (binaryTargets for AWS Lambda)
//   - scripts/netlify-env-shim.mjs (VERCEL_* env var map)
// A regression in any one of these breaks deploys silently — the build
// succeeds but routes 404, crons never fire, or Prisma throws at first
// query. This pinned static test enforces the contract between those
// four surfaces so the POC cannot drift out from under us.
//
// Scope: node-only, no build, no network. Parses text files and cross-
// checks schedules against vercel.json (source of truth for cron cadence).
//
// When this test needs updating:
//   - Adding or removing a cron in vercel.json → add/remove the matching
//     netlify/functions/cron-*.mts bridge.
//   - Changing prisma binary target policy → update EXPECTED_BINARY_TARGETS.
//   - Refactoring away the env shim (Faz 2) → delete this test or flip
//     the shim check to "must NOT exist".

import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..", "..");

function readText(rel: string): string {
  return readFileSync(resolve(REPO_ROOT, rel), "utf8");
}

function exists(rel: string): boolean {
  try {
    statSync(resolve(REPO_ROOT, rel));
    return true;
  } catch {
    return false;
  }
}

interface VercelCron {
  path: string;
  schedule: string;
}

function loadVercelCrons(): VercelCron[] {
  const raw = readText("vercel.json");
  const parsed = JSON.parse(raw) as { crons?: VercelCron[] };
  return parsed.crons ?? [];
}

describe("netlify.toml scaffold", () => {
  const toml = exists("netlify.toml") ? readText("netlify.toml") : "";

  it("exists at repo root", () => {
    expect(exists("netlify.toml")).toBe(true);
  });

  it("uses pnpm build command and pipes through env shim", () => {
    expect(toml).toMatch(/command\s*=\s*".*netlify-env-shim\.mjs.*pnpm run build"/);
  });

  it("publishes .next and pins Node 22", () => {
    expect(toml).toMatch(/publish\s*=\s*"\.next"/);
    expect(toml).toMatch(/NODE_VERSION\s*=\s*"22"/);
  });

  it("declares Prisma AWS Lambda binary target", () => {
    expect(toml).toMatch(
      /PRISMA_CLI_BINARY_TARGETS\s*=\s*"rhel-openssl-3\.0\.x"/,
    );
  });

  it("loads @netlify/plugin-nextjs", () => {
    expect(toml).toMatch(/package\s*=\s*"@netlify\/plugin-nextjs"/);
  });

  it("allow-lists production branches in ignore command", () => {
    // Faz 0 matches this regex on Vercel too — keep them in sync.
    expect(toml).toMatch(/main\|stable\|phase-1-p0-remediations\|netlify-poc/);
  });
});

describe("netlify/functions cron bridges", () => {
  const bridgesDir = resolve(REPO_ROOT, "netlify", "functions");
  const bridges = exists("netlify/functions")
    ? readdirSync(bridgesDir).filter(
        (f) => f.startsWith("cron-") && f.endsWith(".mts"),
      )
    : [];

  it("directory exists", () => {
    expect(exists("netlify/functions")).toBe(true);
  });

  it("has the shared _cron-bridge helper", () => {
    expect(exists("netlify/functions/_cron-bridge.mts")).toBe(true);
  });

  it("ships one bridge per vercel.json cron", () => {
    const crons = loadVercelCrons();
    expect(crons.length).toBeGreaterThan(0);

    for (const cron of crons) {
      // vercel cron path "/api/cron/foo-bar" → "cron-foo-bar.mts"
      const slug = cron.path.replace(/^\/api\/cron\//, "");
      const expected = `cron-${slug}.mts`;
      expect(
        bridges,
        `missing Netlify bridge for ${cron.path} — expected netlify/functions/${expected}`,
      ).toContain(expected);
    }
  });

  it("every bridge declares the same schedule as vercel.json", () => {
    const crons = loadVercelCrons();
    for (const cron of crons) {
      const slug = cron.path.replace(/^\/api\/cron\//, "");
      const file = resolve(bridgesDir, `cron-${slug}.mts`);
      if (!exists(`netlify/functions/cron-${slug}.mts`)) continue;
      const src = readFileSync(file, "utf8");
      const scheduleMatch = src.match(/schedule:\s*"([^"]+)"/);
      expect(
        scheduleMatch?.[1],
        `schedule mismatch in cron-${slug}.mts`,
      ).toBe(cron.schedule);
    }
  });

  it("every bridge delegates to callCronRoute with its path", () => {
    const crons = loadVercelCrons();
    for (const cron of crons) {
      const slug = cron.path.replace(/^\/api\/cron\//, "");
      const rel = `netlify/functions/cron-${slug}.mts`;
      if (!exists(rel)) continue;
      const src = readText(rel);
      expect(
        src,
        `bridge ${rel} must pass the exact route path to callCronRoute`,
      ).toMatch(new RegExp(`callCronRoute\\("${cron.path}"\\)`));
    }
  });
});

describe("prisma schema — Netlify Lambda binary target", () => {
  const EXPECTED_BINARY_TARGETS = ["native", "rhel-openssl-3.0.x"];

  it("generator block declares binaryTargets", () => {
    const schema = readText("prisma/schema.prisma");
    const match = schema.match(/binaryTargets\s*=\s*\[([^\]]+)\]/);
    expect(match, "binaryTargets missing from generator client").not.toBeNull();
    const targets = (match?.[1] ?? "")
      .split(",")
      .map((s) => s.trim().replace(/["']/g, ""))
      .filter(Boolean);
    for (const required of EXPECTED_BINARY_TARGETS) {
      expect(targets, `binaryTargets must include ${required}`).toContain(
        required,
      );
    }
  });
});

describe("netlify-env-shim.mjs", () => {
  const rel = "scripts/netlify-env-shim.mjs";

  it("exists", () => {
    expect(exists(rel)).toBe(true);
  });

  it("short-circuits on Vercel (VERCEL=1)", () => {
    const src = readText(rel);
    expect(src).toMatch(/process\.env\.VERCEL\s*===\s*"1"/);
  });

  it("maps COMMIT_REF → VERCEL_GIT_COMMIT_SHA", () => {
    const src = readText(rel);
    expect(src).toMatch(/COMMIT_REF/);
    expect(src).toMatch(/VERCEL_GIT_COMMIT_SHA/);
  });

  it("maps BRANCH/HEAD → VERCEL_GIT_COMMIT_REF", () => {
    const src = readText(rel);
    expect(src).toMatch(/VERCEL_GIT_COMMIT_REF/);
  });

  it("strips protocol from DEPLOY_PRIME_URL for VERCEL_URL", () => {
    const src = readText(rel);
    expect(src).toMatch(/replace\(\/\^https\?:\\\/\\\/\//);
  });
});
