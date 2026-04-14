// Phase 6B / Item 2 — minimal test harness setup.
//
// `src/lib/env.ts` validates the process environment at module load
// and throws if the required keys are missing. Test files under
// `src/lib/**` that transitively import `env` (rate-limit, invitations,
// etc.) therefore need these keys to exist before any static import
// resolves — which is exactly what vitest's `setupFiles` guarantees.
//
// We deliberately leave UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
// unset so that `src/lib/rate-limit.ts` exercises the in-process
// memory backend. That is the only rate-limit backend the Phase 6B
// test harness is approved to cover — the Upstash REST path is
// network-dependent and out of scope for pure-function tests.
//
// Phase 7D: the explicit `delete` calls below strip any Upstash vars
// that may have been injected on the command line (e.g. the stub
// values passed during `pnpm build` validation). This setup file
// runs before test files are imported, so the `env.ts` module-level
// evaluation sees the vars as absent and `hasUpstash` stays `false`.
// We cannot use vitest's `test.env` config for this because
// `UPSTASH_REDIS_REST_TOKEN` is validated as `z.string().min(1)`
// (not the `optionalUrl` helper), so setting it to "" fails the
// schema instead of being treated as unset.
//
// `process.env.NODE_ENV` is declared as a literal union by the
// Node typings, so we assign through `Object.assign` to avoid the
// read-only property complaint without sprinkling `as never` casts.
Object.assign(process.env, {
  NODE_ENV: "test",
  DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://test:test@localhost:5432/test",
  DIRECT_URL: process.env.DIRECT_URL ?? "postgresql://test:test@localhost:5432/test",
  BETTER_AUTH_SECRET:
    process.env.BETTER_AUTH_SECRET ?? "test-secret-not-for-production-0123456789abcdef",
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
});

// Phase 7D: strip Upstash vars so the rate-limit module falls back to
// the in-memory backend, regardless of what the caller's shell exports.
process.env.UPSTASH_REDIS_REST_URL = undefined;
process.env.UPSTASH_REDIS_REST_TOKEN = undefined;
