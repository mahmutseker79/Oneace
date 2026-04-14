// Hardening Track — Next.js instrumentation hook.
//
// This file is the official Next.js entry point for initialising
// server-side observability tooling. Next.js calls `register()` once
// per server process start, before the first request is served.
//
// `register` is an async function so heavy imports (Sentry, OpenTelemetry)
// don't block the module graph at cold start — they're imported lazily
// inside the function only when the right runtime is detected.
//
// Runtime branches:
//   "nodejs"   — standard Next.js server / Vercel serverless functions.
//   "edge"     — Next.js middleware (V8 edge runtime).
//
// The Sentry config files are thin wrappers around `Sentry.init()`.
// When SENTRY_DSN is unset they are safe no-ops.

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}
