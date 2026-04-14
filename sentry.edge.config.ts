// Hardening Track — Sentry edge runtime configuration.
//
// Next.js middleware runs in the V8 edge runtime. This file is the
// Sentry init point for that environment. The edge SDK is a subset
// of the full Node SDK — no Node-specific APIs, lighter bundle.

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),

  enabled: process.env.NODE_ENV === "production",

  environment: process.env.NODE_ENV,

  debug: false,
});
