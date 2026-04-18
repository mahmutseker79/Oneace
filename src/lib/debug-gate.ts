/**
 * God-Mode v2 §2.1 — debug-route access gate.
 *
 * Used by `/api/debug-dashboard` (and any future diagnostic route) to
 * decide whether to honour the request or 404 it out of existence.
 *
 * Policy:
 *   - In non-production environments, any authenticated user with an
 *     active membership may reach debug routes. The dev experience is
 *     more important than strict isolation here, and the data exposed
 *     is the caller's own org anyway.
 *   - In production, debug routes are disabled by default. They only
 *     unlock when BOTH:
 *       (a) `ENABLE_DEBUG_DASHBOARD=true` is set in the environment
 *           (an explicit operator opt-in), AND
 *       (b) the caller's active-org role is OWNER (the only role that
 *           is expected to be held by the operator themselves).
 *
 * This is a pure function so we can unit-test the policy without
 * booting Next, Prisma, or a real session. Route handlers are a thin
 * wrapper: resolve the membership, call this helper, and `notFound()`
 * on `false`.
 */

export type DebugGateInput = {
  /** Validated `env.NODE_ENV`. */
  nodeEnv: "development" | "test" | "production";
  /** Validated `env.ENABLE_DEBUG_DASHBOARD` (post-transform boolean). */
  enableDebugDashboard: boolean;
  /** Active-org role of the authenticated user. */
  role: string;
};

/**
 * Returns `true` when the debug route should execute, `false` when
 * the handler should respond with `notFound()` / a 404.
 */
export function isDebugRouteAllowed(input: DebugGateInput): boolean {
  if (input.nodeEnv !== "production") {
    // Dev / test / preview builds: any authenticated user with an
    // active membership may poke at the debug surface.
    return true;
  }
  // Production: require explicit operator opt-in AND OWNER role.
  return input.enableDebugDashboard === true && input.role === "OWNER";
}
