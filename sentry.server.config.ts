// Hardening Track — Sentry Node.js SDK configuration.
//
// This file is imported by `src/instrumentation.ts` via Next.js's
// instrumentation hook, which fires once per server process startup —
// before any requests are handled. That makes it the correct place to
// call `Sentry.init` for the server runtime.
//
// When `SENTRY_DSN` is not set the SDK is a safe no-op.

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),

  enabled: process.env.NODE_ENV === "production",

  environment: process.env.NODE_ENV,

  debug: false,
});
