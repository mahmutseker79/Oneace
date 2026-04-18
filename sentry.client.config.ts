// Hardening Track — Sentry browser SDK configuration.
//
// This file is loaded by Next.js when it detects `@sentry/nextjs` in
// the project. It runs in the browser for every page load. When
// `NEXT_PUBLIC_SENTRY_DSN` is not set (local dev, CI without Sentry
// config), `init` is a safe no-op — the SDK initialises with no DSN
// and simply skips all uploads.
//
// We intentionally do NOT call `Sentry.init` with a hardcoded DSN.
// The DSN is injected at build time via the environment variable so
// staging and production can use different projects.

import * as Sentry from "@sentry/nextjs";

import { getTracesSampleRate } from "@/lib/sentry-sample-rate";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // v1.2 P3 §5.42 — env-aware default. Dev = 1.0 (full tracing for
  // local repros), test = 0.0 (never upload), prod = 0.1 (quota).
  // SENTRY_TRACES_SAMPLE_RATE still wins when explicitly set.
  tracesSampleRate: getTracesSampleRate(),

  // Capture 10% of user sessions that contain an error for replay.
  replaysOnErrorSampleRate: 0.1,

  // Off in development to avoid polluting the Sentry project with
  // local noise. Flip to true (or remove the guard) to test.
  enabled: process.env.NODE_ENV === "production",

  // Sentry environment tag — mirrors the Next.js NODE_ENV so issues
  // are bucketed by environment in the Sentry UI.
  environment: process.env.NODE_ENV,

  // Suppress verbose SDK logs in the browser console.
  debug: false,
});
