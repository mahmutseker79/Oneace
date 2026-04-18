// Hardening Track — Sentry edge runtime configuration.
//
// Next.js middleware runs in the V8 edge runtime. This file is the
// Sentry init point for that environment. The edge SDK is a subset
// of the full Node SDK — no Node-specific APIs, lighter bundle.

import * as Sentry from "@sentry/nextjs";

import { getTracesSampleRate } from "@/lib/sentry-sample-rate";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // v1.2 P3 §5.42 — see sentry-sample-rate.ts for the env matrix.
  tracesSampleRate: getTracesSampleRate(),

  enabled: process.env.NODE_ENV === "production",

  environment: process.env.NODE_ENV,

  debug: false,
});
