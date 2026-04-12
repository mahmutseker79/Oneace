#!/usr/bin/env node
// Phase 7B / P3 — minimal release smoke script.
//
// Purpose: the machine-readable floor of the post-deploy smoke
// checklist in DEPLOY.md §5. This is not a replacement for the
// human smoke steps (sign in, create a movement, sign out/in) —
// those still matter. This script only answers the most basic
// question: "is /api/health returning ok with every sub-check
// green on the freshly deployed URL?"
//
// Constraints (intentional, per Phase 7B scope):
//   * Node built-ins only — no dependencies, no transitive blast
//     radius. Uses the global `fetch` shipped with Node >= 18.
//   * Single file. Runnable as `pnpm smoke` from the repo root and
//     from a GitHub Actions `workflow_dispatch` job once that gets
//     wired up in a later phase.
//   * Fails non-zero on any unhealthy signal (missing env var,
//     non-200 response, JSON parse error, any sub-check != "ok"
//     other than `migrations: "skipped"`, which is the documented
//     Phase 7A floor behaviour).
//
// Usage:
//   SMOKE_URL=https://app.example.com pnpm smoke
//
// The URL is the app's origin — the script appends `/api/health`.
// Passing the full path (`.../api/health`) also works; the script
// normalises trailing slashes and duplicate paths.

const MIN_NODE_MAJOR = 18;
const TIMEOUT_MS = 10_000;

function fail(message) {
  process.stderr.write(`[smoke] FAIL: ${message}\n`);
  process.exit(1);
}

function ok(message) {
  process.stdout.write(`[smoke] OK: ${message}\n`);
}

// ---- Preconditions ----------------------------------------------------------

const nodeMajor = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
if (!Number.isFinite(nodeMajor) || nodeMajor < MIN_NODE_MAJOR) {
  fail(`Node >= ${MIN_NODE_MAJOR} required (found ${process.versions.node})`);
}

if (typeof fetch !== "function") {
  fail("global fetch is not available — upgrade Node to 18+ or run under a fetch-capable runtime");
}

const rawUrl = process.env.SMOKE_URL;
if (!rawUrl || rawUrl.trim() === "") {
  fail("SMOKE_URL env var is required (e.g. SMOKE_URL=https://app.example.com pnpm smoke)");
}

// ---- URL normalisation ------------------------------------------------------

function buildHealthUrl(input) {
  let url;
  try {
    url = new URL(input);
  } catch {
    fail(`SMOKE_URL is not a valid URL: ${input}`);
    return null; // unreachable, satisfies the type checker
  }
  // Normalise: strip any trailing slash, then ensure /api/health is
  // appended exactly once. Tolerant of both bare origins and full
  // /api/health URLs so operators can paste either form.
  const stripped = url.pathname.replace(/\/+$/, "");
  if (stripped.endsWith("/api/health")) {
    url.pathname = stripped;
  } else {
    url.pathname = `${stripped}/api/health`;
  }
  return url.toString();
}

const healthUrl = buildHealthUrl(rawUrl);
ok(`probing ${healthUrl}`);

// ---- Request with timeout ---------------------------------------------------

const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

let response;
try {
  response = await fetch(healthUrl, {
    signal: controller.signal,
    headers: { Accept: "application/json" },
    // No redirect following — a probe should hit the exact URL we
    // asked for. A redirect to a login page would be a real bug.
    redirect: "manual",
  });
} catch (err) {
  clearTimeout(timer);
  const message = err && typeof err === "object" && "message" in err ? err.message : String(err);
  fail(`network error fetching ${healthUrl}: ${message}`);
} finally {
  clearTimeout(timer);
}

if (!response) {
  fail(`no response from ${healthUrl}`);
}

if (response.status !== 200) {
  // Capture a short body preview for diagnostics. We do not trust
  // the body to be JSON on a non-200 — an upstream edge or firewall
  // might return HTML or plain text.
  let preview = "";
  try {
    preview = (await response.text()).slice(0, 200);
  } catch {
    preview = "(body unreadable)";
  }
  fail(`unexpected status ${response.status} from ${healthUrl}: ${preview}`);
}

// ---- Response shape validation ----------------------------------------------

let body;
try {
  body = await response.json();
} catch (err) {
  const message = err && typeof err === "object" && "message" in err ? err.message : String(err);
  fail(`response was not valid JSON: ${message}`);
}

if (!body || typeof body !== "object") {
  fail("response body was not a JSON object");
}

if (body.status !== "ok") {
  fail(
    `status=${JSON.stringify(body.status)} (expected "ok"); errors=${JSON.stringify(body.errors ?? [])}`,
  );
}

const checks = body.checks;
if (!checks || typeof checks !== "object") {
  fail("response body is missing a `checks` object");
}

// Every required sub-check must be "ok". `migrations: "skipped"` is
// explicitly allowed — it is the documented Phase 7A floor for
// environments where EXPECTED_MIGRATION_COUNT is not wired yet.
const requiredOk = ["database", "schema"];
for (const name of requiredOk) {
  if (checks[name] !== "ok") {
    fail(`checks.${name}=${JSON.stringify(checks[name])} (expected "ok")`);
  }
}

if (
  checks.migrations !== undefined &&
  checks.migrations !== "ok" &&
  checks.migrations !== "skipped"
) {
  fail(`checks.migrations=${JSON.stringify(checks.migrations)} (expected "ok" or "skipped")`);
}

ok(
  `status=ok database=${checks.database} schema=${checks.schema} migrations=${checks.migrations ?? "(absent)"} commit=${body.commit ?? "(unknown)"}`,
);
process.exit(0);
