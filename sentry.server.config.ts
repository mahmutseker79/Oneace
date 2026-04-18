// Hardening Track — Sentry Node.js SDK configuration.
//
// This file is imported by `src/instrumentation.ts` via Next.js's
// instrumentation hook, which fires once per server process startup —
// before any requests are handled. That makes it the correct place to
// call `Sentry.init` for the server runtime.
//
// When `SENTRY_DSN` is not set the SDK is a safe no-op.

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
