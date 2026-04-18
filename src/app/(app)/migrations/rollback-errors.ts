// P1-2 remediation (audit v1.0 §5.7) — migration rollback error type.
//
// Lives in its own file because `actions.ts` is marked `"use server"`,
// and Next.js 15's RSC compiler rejects any non-async export from a
// `"use server"` module (the Vercel build fails with:
//   "Only async functions are allowed to be exported in a
//    \"use server\" file.")
// The previous layout co-located this class with the server action
// that throws it; that compiled locally but broke the production
// build on Vercel. The class now lives here and `actions.ts` imports
// it, keeping the `"use server"` module async-only.
//
// Keep this file thin on purpose — no `"use server"`, no runtime
// imports, just the error type. Both the server action and the API
// route can import it safely.

export class MigrationRollbackNotImplementedError extends Error {
  readonly code = "NOT_IMPLEMENTED";
  constructor() {
    super(
      "Migration rollback is not available in v1. Migrations are one-way; " +
        "contact support for manual remediation from a pre-migration backup.",
    );
    this.name = "MigrationRollbackNotImplementedError";
  }
}
