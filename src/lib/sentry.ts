/**
 * Hardening Track — Sentry client-side capture helpers.
 *
 * Thin re-export of the two Sentry functions used in error boundaries.
 * Importing from this module instead of `@sentry/nextjs` directly means:
 *   - A single import to update if the SDK ever changes.
 *   - The error boundary files stay clean and obvious.
 *
 * Both functions are safe no-ops when Sentry has not been initialised
 * (e.g. `NEXT_PUBLIC_SENTRY_DSN` is not set in development).
 */

export { captureException, withScope } from "@sentry/nextjs";
