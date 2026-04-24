#!/usr/bin/env node
/**
 * Netlify → Vercel env var shim (Faz 1 POC).
 *
 * WHY: OneAce code written for Vercel reads `VERCEL_GIT_COMMIT_SHA`,
 * `VERCEL_GIT_COMMIT_REF`, `VERCEL_URL`, etc. directly from process.env
 * (health route, analytics, logger). Refactoring every caller to a
 * platform-agnostic shim is Faz 2 work (audit v1.3 F-01/F-04). For the
 * Faz 1 POC we keep the call sites untouched and instead map Netlify's
 * equivalent env vars into the names the code expects.
 *
 * When: runs as part of `build.command` before `pnpm run build`. It
 * mutates `process.env` in this node process; the child `next build`
 * inherits the patched env. It does NOT write to any file on disk and
 * does NOT leak secrets. For safety this script is a NO-OP on Vercel
 * (detected via `process.env.VERCEL === "1"`) so running it everywhere
 * is idempotent.
 *
 * Netlify → Vercel mapping:
 *   COMMIT_REF         → VERCEL_GIT_COMMIT_SHA (full SHA)
 *   HEAD / BRANCH      → VERCEL_GIT_COMMIT_REF
 *   REPOSITORY_URL     → VERCEL_GIT_REPO_SLUG (parsed)
 *   DEPLOY_PRIME_URL   → VERCEL_URL (drop protocol; Vercel convention)
 *   CONTEXT=production → VERCEL_ENV=production
 *   CONTEXT=deploy-preview | branch-deploy → VERCEL_ENV=preview
 *   CONTEXT=dev        → VERCEL_ENV=development
 *
 * Usage (netlify.toml):
 *   [build]
 *     command = "node scripts/netlify-env-shim.mjs && pnpm run build"
 */

function log(msg) {
  // eslint-disable-next-line no-console
  console.log(`[netlify-env-shim] ${msg}`);
}

function parseRepoSlug(repositoryUrl) {
  if (!repositoryUrl) return undefined;
  // Accepts: https://github.com/user/repo[.git], git@github.com:user/repo.git
  const https = repositoryUrl.match(/github\.com[/:]([^/]+)\/([^/.]+)(?:\.git)?$/i);
  if (https) return `${https[1]}/${https[2]}`;
  return undefined;
}

function contextToVercelEnv(context) {
  switch (context) {
    case "production":
      return "production";
    case "deploy-preview":
    case "branch-deploy":
      return "preview";
    case "dev":
      return "development";
    default:
      return undefined;
  }
}

function main() {
  // Short-circuit on Vercel — the native env is already correct.
  if (process.env.VERCEL === "1") {
    log("detected VERCEL=1 — skipping shim (no-op on Vercel)");
    return;
  }

  // Sanity: if no Netlify hint present, just warn and continue without
  // failing the build. Local runs of `pnpm run build` will land here.
  const onNetlify =
    process.env.NETLIFY === "true" || !!process.env.DEPLOY_PRIME_URL || !!process.env.COMMIT_REF;

  if (!onNetlify) {
    log("no Netlify hints (NETLIFY/DEPLOY_PRIME_URL/COMMIT_REF) — skipping");
    return;
  }

  const mapped = [];

  if (process.env.COMMIT_REF && !process.env.VERCEL_GIT_COMMIT_SHA) {
    process.env.VERCEL_GIT_COMMIT_SHA = process.env.COMMIT_REF;
    mapped.push("VERCEL_GIT_COMMIT_SHA");
  }

  const branch = process.env.BRANCH || process.env.HEAD;
  if (branch && !process.env.VERCEL_GIT_COMMIT_REF) {
    process.env.VERCEL_GIT_COMMIT_REF = branch;
    mapped.push("VERCEL_GIT_COMMIT_REF");
  }

  const repoSlug = parseRepoSlug(process.env.REPOSITORY_URL);
  if (repoSlug && !process.env.VERCEL_GIT_REPO_SLUG) {
    process.env.VERCEL_GIT_REPO_SLUG = repoSlug;
    mapped.push("VERCEL_GIT_REPO_SLUG");
  }

  // VERCEL_URL convention is no protocol, no trailing slash.
  const deployUrl = process.env.DEPLOY_PRIME_URL || process.env.URL;
  if (deployUrl && !process.env.VERCEL_URL) {
    process.env.VERCEL_URL = deployUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
    mapped.push("VERCEL_URL");
  }

  const vercelEnv = contextToVercelEnv(process.env.CONTEXT);
  if (vercelEnv && !process.env.VERCEL_ENV) {
    process.env.VERCEL_ENV = vercelEnv;
    mapped.push("VERCEL_ENV");
  }

  if (mapped.length === 0) {
    log("nothing to map (all VERCEL_* already set or no Netlify vars)");
    return;
  }

  log(`mapped ${mapped.length} var(s): ${mapped.join(", ")}`);
}

main();
