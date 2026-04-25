// Sprint 1 PR #4 — no raw `<div>Loading...</div>` fallbacks
// (UX/UI audit Apr-25 §B-4).
//
// Two client components were returning a bare unstyled English
// "Loading..." div while messages or remote data resolved. That:
//   1. ignored the `Skeleton` primitive's visual contract
//   2. baked English copy into the component (locale leak)
//   3. created a flash of unstyled text on slow networks
//
// This PR replaces both with the canonical `<Skeleton />` primitive.
// The static lint below blocks the pattern from sneaking back in via
// a future copy-paste.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..");
const SRC = resolve(REPO_ROOT, "src");

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      // Skip generated folders
      if (entry === "node_modules" || entry === ".next" || entry === "generated") continue;
      yield* walk(full);
    } else if (entry.endsWith(".tsx") || entry.endsWith(".ts")) {
      yield full;
    }
  }
}

describe("PR #4 §B-4 — no raw <div>Loading...</div> fallbacks anywhere in src/", () => {
  it("zero matches across all .ts/.tsx files (lint guard)", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      // Skip the test itself (regex would self-match).
      if (file.endsWith("no-hardcoded-loading-divs.test.ts")) continue;
      const content = readFileSync(file, "utf8");
      if (/<div>\s*Loading\.\.\.\s*<\/div>/.test(content)) {
        offenders.push(file.replace(`${REPO_ROOT}/`, ""));
      }
    }
    expect(offenders, `Use <Skeleton /> instead. Offenders: ${offenders.join(", ")}`).toEqual([]);
  });
});
