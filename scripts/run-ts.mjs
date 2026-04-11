#!/usr/bin/env node
// Sprint 40 — tiny jiti-based runner for ad-hoc TypeScript scripts.
//
// We have exactly one TS script right now (`src/scripts/prune-audit.ts`),
// invoked by `npm run audit:prune`. Rather than adding `tsx` or `ts-node`
// as a devDependency, we lean on `jiti` — it's already installed as a
// transitive Next.js dep and supports TypeScript + ESM natively.
//
// The jiti CLI ships with JITI_ALIAS support, but the env-var form needs
// an absolute path to correctly resolve `@/*` imports from any cwd. That
// makes it awkward to wire into package.json. A two-line wrapper that
// computes the absolute path at runtime is simpler and portable across
// machines, CI, and cron invocations alike.
//
// Usage:
//   node scripts/run-ts.mjs src/scripts/prune-audit.ts
//
// Any additional argv is forwarded to the script under process.argv.

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createJiti } from "jiti";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");

const target = process.argv[2];
if (!target) {
  console.error("Usage: node scripts/run-ts.mjs <path-to-ts-file>");
  process.exit(1);
}

const jiti = createJiti(import.meta.url, {
  alias: {
    "@": resolve(repoRoot, "src"),
  },
});

try {
  await jiti.import(resolve(repoRoot, target));
} catch (err) {
  console.error(err);
  process.exit(1);
}
