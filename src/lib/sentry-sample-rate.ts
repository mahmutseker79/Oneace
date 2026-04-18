// v1.2 P3 §5.42 — env-aware Sentry trace sample rate.
//
// The three sentry.*.config.ts files (client, server, edge) all
// shipped with the same line:
//
//   tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1")
//
// That hardcodes a 10% default across every environment. Production
// was fine; staging and dev got the same 10% sample, so a local
// repro often had no trace attached to the error event even though
// the developer was on the same box. Flipping to 100% in dev is
// cheap — no quota implication when there's no DSN — and makes
// local debugging actually useful.
//
// This helper centralizes the default-rate logic so all three
// Sentry entry points agree and a future tweak is one-line.
//
// Why a helper vs inlining three copies:
//   - the env-aware branch deserves a home that can be unit-tested
//     independently of the SDK init (which has side effects),
//   - sentry-config.test.ts can then pin that all three configs
//     import and call the helper, rather than hunting literal
//     numbers in three files.
//
// Environment matrix:
//
//   | NODE_ENV     | default rate | rationale                     |
//   | ------------ | ------------ | ----------------------------- |
//   | development  | 1.0          | full tracing locally          |
//   | test         | 0.0          | never upload from test runs   |
//   | production   | 0.1          | 10% — keeps us under quota    |
//   | anything else| 0.1          | treat unknown as prod-safe    |
//
// `SENTRY_TRACES_SAMPLE_RATE` still wins when set (e.g. Vercel
// preview deploys can dial this to 0.5 to get richer traces on
// staging without touching code).

/**
 * Decide the Sentry `tracesSampleRate` for the current runtime.
 *
 * Resolution order:
 *   1. `SENTRY_TRACES_SAMPLE_RATE` env var (if set and parses as a
 *      finite number in [0, 1]).
 *   2. `NODE_ENV`-aware default (see matrix above).
 *
 * Keeping this deterministic-per-input means the test can pin every
 * branch without spinning up the real Sentry SDK.
 */
export function getTracesSampleRate(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.SENTRY_TRACES_SAMPLE_RATE;
  if (typeof raw === "string" && raw.trim() !== "") {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) {
      return parsed;
    }
    // Fall through on a malformed value — the env-aware default is
    // safer than returning NaN, which would break the SDK init.
  }
  switch (env.NODE_ENV) {
    case "development":
      return 1.0;
    case "test":
      return 0.0;
    default:
      // `production` or an unknown value — treat as prod-safe.
      return 0.1;
  }
}
