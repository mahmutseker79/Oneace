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

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Trace a fraction of requests for performance monitoring. The
  // default (0.1 = 10%) keeps us well within Sentry's free quota.
  // Override via SENTRY_TRACES_SAMPLE_RATE in production env vars.
  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),

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
