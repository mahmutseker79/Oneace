/**
 * @openapi-tag: /cron/vercel-quota-health
 *
 * REMOVED (was CRON_SECRET-protected; superseded by platform-*) — replaced by src/app/api/cron/platform-quota-health/route.ts
 * (Faz 2 rename, v1.5.32-audit-v1.3-platform-agnostic).
 *
 * The `@openapi-tag` above is retained purely so the openapi-parity
 * test keeps recognizing this file as a route — that test treats a
 * missing tag as a hard failure. The tag path is NOT present in
 * docs/openapi.yaml (deliberately); it is listed in DOCUMENTED_GAPS
 * in src/lib/openapi-parity.test.ts as a known-removed legacy route.
 */
// REMOVED (legacy stub — see header).
//
// This file remains on disk only because the Cowork FUSE sandbox
// refuses unlink(). It is removed from the git index and will be
// absent in any non-FUSE checkout (CI, Vercel, Netlify, contributors).
//
// The 410 handler below exists so that IF the file somehow survives
// into a build, the endpoint returns a clear signal rather than a
// silent 200 duplicating the new platform-quota-health behavior.
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      ok: false,
      status: "gone",
      detail: "Renamed to /api/cron/platform-quota-health in v1.5.32",
    },
    { status: 410 },
  );
}
