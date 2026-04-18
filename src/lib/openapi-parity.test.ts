// P3-4 (audit v1.1 §5.32) — OpenAPI / route.ts parity guard.
//
// Every file under `src/app/api/**/route.ts` carries an
// `@openapi-tag: <path>` header comment. This test pins three
// invariants so the doc and the code cannot drift silently:
//
//   1. Tag presence — every route.ts MUST have an `@openapi-tag`.
//      No exceptions. The header is how docs/openapi.yaml and the
//      filesystem reference each other.
//
//   2. Coverage freeze — any route whose tag is NOT documented in
//      docs/openapi.yaml is listed in `DOCUMENTED_GAPS`. The test
//      fails if a NEW undocumented route appears (someone shipped
//      code without updating the spec) AND if an existing gap is
//      now documented (the entry is obsolete and must be removed
//      so the next gap is obvious). Coverage only tightens.
//
//   3. Method parity — for every route that IS documented, the set
//      of HTTP methods exported from route.ts must exactly match
//      the set of methods declared under that path in
//      openapi.yaml. Missing methods mean the code grew; extra
//      means the spec lies.
//
// Static-only: readFileSync + regex. No YAML parser dep, no Prisma,
// no network. The openapi parser is intentionally minimal — it
// cares about `paths:` and the immediate method-keyed children.
// Schema bodies, examples, and component refs are out of scope.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..");
const API_ROOT = resolve(REPO_ROOT, "src", "app", "api");
const OPENAPI_PATH = resolve(REPO_ROOT, "docs", "openapi.yaml");

type Methods = Set<"GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS" | "HEAD">;
const HTTP_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"];

interface RouteInfo {
  file: string;
  relFile: string;
  tag: string | null;
  methods: Methods;
}

/** Walk src/app/api and collect route.ts(x) files. */
function listRouteFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) out.push(...listRouteFiles(full));
    else if (entry === "route.ts" || entry === "route.tsx") out.push(full);
  }
  return out;
}

/** Next.js [id] / [...all] → OpenAPI {id} / {...all}. */
function fsPathToOpenApi(tag: string): string {
  return tag.replace(/\[\.\.\.([^\]]+)\]/g, "{...$1}").replace(/\[([^\]]+)\]/g, "{$1}");
}

/**
 * Extract the `@openapi-tag: <path>` value and the set of HTTP
 * methods exported from a route file. Supports three export forms
 * that appear in this codebase:
 *
 *   - `export async function POST(...) {...}`
 *   - `export function GET(...) {...}` (sync)
 *   - `export { GET, something as POST }` (re-export with rename,
 *     e.g. the Better Auth catch-all)
 *   - `export const POST = ...`
 */
function readRoute(file: string): RouteInfo {
  const content = readFileSync(file, "utf8");
  const relFile = file.slice(REPO_ROOT.length + 1);
  const tagMatch = content.match(/@openapi-tag:\s*(\S+)/);
  const methods: Methods = new Set();
  const methodGroup = HTTP_METHODS.join("|");

  // export async function METHOD / export function METHOD
  for (const m of content.matchAll(
    new RegExp(`export\\s+(?:async\\s+)?function\\s+(${methodGroup})\\s*\\(`, "g"),
  )) {
    methods.add(m[1] as never);
  }

  // export const METHOD = ...
  for (const m of content.matchAll(new RegExp(`export\\s+const\\s+(${methodGroup})\\s*=`, "g"))) {
    methods.add(m[1] as never);
  }

  // export { X, Y as METHOD, ... } — parse every comma-separated
  // entry and pick the tail identifier (after an optional `as`).
  for (const block of content.matchAll(/export\s*\{([^}]+)\}/g)) {
    const entries = block[1].split(",");
    for (const raw of entries) {
      const parts = raw.trim().split(/\s+as\s+/);
      const name = (parts.length === 2 ? parts[1] : parts[0]).trim();
      if (HTTP_METHODS.includes(name)) methods.add(name as never);
    }
  }

  return { file, relFile, tag: tagMatch ? tagMatch[1] : null, methods };
}

/**
 * Parse docs/openapi.yaml into `{ path: Set<method> }`. We only
 * walk the paths section; anything else in the file is ignored.
 * Format assumptions match the existing file: 2-space indent for
 * paths, 4-space indent for methods.
 */
function parseOpenApi(text: string): Record<string, Methods> {
  const paths: Record<string, Methods> = {};
  const lines = text.split("\n");
  let i = 0;
  while (i < lines.length && lines[i] !== "paths:") i++;
  i++;
  let currentPath: string | null = null;
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (/^[a-zA-Z]/.test(line)) break;
    const pathMatch = line.match(/^ {2}(\/[^:\s]*):$/);
    if (pathMatch) {
      currentPath = pathMatch[1];
      paths[currentPath] = new Set();
      continue;
    }
    const methodMatch = line.match(/^ {4}(get|post|put|delete|patch|options|head):/);
    if (methodMatch && currentPath) {
      paths[currentPath].add(methodMatch[1].toUpperCase() as never);
    }
  }
  return paths;
}

// ── Frozen state ──────────────────────────────────────────────────
//
// v1.1.1 backlog-clear (2026-04-18): both lists cleared. Every route
// is now documented in openapi.yaml, and every exported HTTP method
// is declared in the spec. The arrays and the stale-checks below are
// retained intentionally — any future drift has an obvious,
// symmetric landing pad:
//
// DOCUMENTED_GAPS: add the OpenAPI path when a new route ships
// before the spec is updated. Remove the entry when the spec catches
// up (the stale-gap test below fails otherwise).
//
// KNOWN_METHOD_MISMATCHES: add the method delta when exports and the
// spec diverge ({ missing?: methods route has but doc does not;
// extra?: methods doc has but route does not }). Remove the entry
// when the divergence is resolved (the still-diverges test below
// fails otherwise).
const DOCUMENTED_GAPS: readonly string[] = [];

const KNOWN_METHOD_MISMATCHES: Record<
  string,
  { missing?: readonly string[]; extra?: readonly string[] }
> = {};

// ── Load everything once ─────────────────────────────────────────

const ROUTES: RouteInfo[] = listRouteFiles(API_ROOT).map(readRoute);
const OPENAPI = parseOpenApi(readFileSync(OPENAPI_PATH, "utf8"));

describe("P3-4 §5.32 — every route.ts carries an @openapi-tag", () => {
  it("at least one route file exists", () => {
    expect(ROUTES.length).toBeGreaterThan(0);
  });
  for (const r of ROUTES) {
    it(`${r.relFile} has @openapi-tag`, () => {
      expect(
        r.tag,
        `${r.relFile} must carry an '@openapi-tag: /path' header — it is the only doc/code link`,
      ).not.toBeNull();
    });
  }
});

describe("P3-4 §5.32 — coverage freeze (no new undocumented routes)", () => {
  const undocumented: string[] = [];
  for (const r of ROUTES) {
    if (!r.tag) continue;
    const oapi = fsPathToOpenApi(r.tag);
    if (!(oapi in OPENAPI)) undocumented.push(oapi);
  }

  it("every undocumented route is in DOCUMENTED_GAPS (no new gaps)", () => {
    const newGaps = undocumented.filter((p) => !DOCUMENTED_GAPS.includes(p));
    expect(
      newGaps,
      "These routes have no entry in docs/openapi.yaml. Add them to the spec OR to DOCUMENTED_GAPS in this test.",
    ).toEqual([]);
  });

  it("every DOCUMENTED_GAPS entry is still actually undocumented (no stale gaps)", () => {
    const stale = DOCUMENTED_GAPS.filter((p) => p in OPENAPI);
    expect(
      stale,
      "These paths now ARE documented — remove them from DOCUMENTED_GAPS so the next real gap is visible.",
    ).toEqual([]);
  });
});

describe("P3-4 §5.32 — method parity for documented routes", () => {
  for (const r of ROUTES) {
    if (!r.tag) continue;
    const oapi = fsPathToOpenApi(r.tag);
    if (!(oapi in OPENAPI)) continue; // Covered by the freeze block.

    it(`${oapi} methods match route.ts exports`, () => {
      const routeMethods = new Set(r.methods);
      const openapiMethods = new Set(OPENAPI[oapi]);
      const missingInOpenapi = [...routeMethods].filter((m) => !openapiMethods.has(m));
      const extraInOpenapi = [...openapiMethods].filter((m) => !routeMethods.has(m));

      const known = KNOWN_METHOD_MISMATCHES[oapi];
      const allowedMissing = new Set(known?.missing ?? []);
      const allowedExtra = new Set(known?.extra ?? []);

      const unexpectedMissing = missingInOpenapi.filter((m) => !allowedMissing.has(m));
      const unexpectedExtra = extraInOpenapi.filter((m) => !allowedExtra.has(m));

      expect(
        unexpectedMissing,
        `route.ts for ${oapi} exports methods not declared in openapi.yaml`,
      ).toEqual([]);
      expect(
        unexpectedExtra,
        `openapi.yaml declares methods for ${oapi} that route.ts does not export`,
      ).toEqual([]);
    });
  }
});

describe("P3-4 §5.32 — KNOWN_METHOD_MISMATCHES entries are still mismatches", () => {
  // If a known-mismatch becomes a match (route updated or spec
  // updated), the entry must be removed so future regressions are
  // caught. Same pattern as the stale-gap check above.
  //
  // v1.1.1 (2026-04-18): list is currently empty. Keep the sentinel
  // `it` below so vitest doesn't complain about an empty describe —
  // it documents the invariant ("no known mismatches right now") and
  // silently passes. When an entry is added back, the for-loop below
  // creates a real test per entry and this sentinel still passes.
  it("KNOWN_METHOD_MISMATCHES is either empty or contains only live divergences", () => {
    expect(typeof KNOWN_METHOD_MISMATCHES).toBe("object");
  });
  for (const [oapi, expected] of Object.entries(KNOWN_METHOD_MISMATCHES)) {
    it(`${oapi} still diverges as documented`, () => {
      const route = ROUTES.find((r) => fsPathToOpenApi(r.tag ?? "") === oapi);
      expect(route, `${oapi} should still exist as a route.ts`).toBeDefined();
      const openapiMethods = OPENAPI[oapi];
      expect(openapiMethods, `${oapi} should still exist in openapi.yaml`).toBeDefined();
      const routeMethods = route?.methods;
      const stillMissing = (expected.missing ?? []).filter(
        (m) => !openapiMethods.has(m as never) && routeMethods.has(m as never),
      );
      const stillExtra = (expected.extra ?? []).filter(
        (m) => openapiMethods.has(m as never) && !routeMethods.has(m as never),
      );
      expect(
        stillMissing.length === (expected.missing ?? []).length &&
          stillExtra.length === (expected.extra ?? []).length,
        `KNOWN_METHOD_MISMATCHES[${oapi}] is obsolete — the mismatch has been resolved. Remove it.`,
      ).toBe(true);
    });
  }
});
