// REMOVED — replaced by src/app/api/cron/platform-quota-health/route.test.ts
// (Faz 2 rename, v1.5.32-audit-v1.3-platform-agnostic).
//
// This file remains on disk solely because the Cowork FUSE sandbox
// refuses unlink() on mounted Mac folders. It is already removed from
// the git index (see `git ls-files`) and will be absent from any
// non-FUSE checkout (CI, contributors, Netlify/Vercel builds).
//
// Keep the describe block present but empty so vitest doesn't fail
// with "No test suite found" — and does not assert against the now-
// renamed vercel.json cron paths.
import { describe, it } from "vitest";

describe("vercel-quota-health (removed — see platform-quota-health)", () => {
  it.skip("replaced by platform-quota-health", () => {});
});
