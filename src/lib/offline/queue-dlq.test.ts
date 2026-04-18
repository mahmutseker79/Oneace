/**
 * P2-5 (audit v1.0 §12.2) — pin the offline-queue dead-letter
 * policy so a later refactor can't silently remove the retry
 * ceiling.
 *
 * The audit called out that `markOpFailed` with `retryable: true`
 * re-stamped the row as `pending` unconditionally, which meant a
 * dispatcher returning "retry" on every call would loop forever,
 * burning client CPU and hiding the real bug. The fix is a hard
 * cap: once `attemptCount >= MAX_OP_ATTEMPTS`, even a retryable
 * outcome is forced into `failed` (dead-letter) so the user sees
 * the stuck op on /offline/queue instead of the runner spinning
 * in the background.
 *
 * These are static-analysis tests rather than Dexie-backed unit
 * tests on purpose: the guarantees we care about here — the cap
 * value, the `capReached` comparison, the forced-to-failed branch
 * — are all readable from source, and a structural check is
 * cheap, fast, and doesn't need a fake IndexedDB to run in CI.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { MAX_OP_ATTEMPTS } from "./queue";

const SOURCE_PATH = join(process.cwd(), "src/lib/offline/queue.ts");
const source = readFileSync(SOURCE_PATH, "utf8");

describe("offline queue dead-letter policy (§12.2)", () => {
  it("exports MAX_OP_ATTEMPTS as a positive integer", () => {
    expect(typeof MAX_OP_ATTEMPTS).toBe("number");
    expect(Number.isInteger(MAX_OP_ATTEMPTS)).toBe(true);
    expect(MAX_OP_ATTEMPTS).toBeGreaterThan(0);
  });

  it("caps retries in the low single digits (conservative ceiling)", () => {
    // Too low → a normal online/offline flap tips real ops into
    // the DLQ. Too high → users never see a genuinely broken op
    // surface. The audit fix picked 8 — pin the band so a
    // casual bump doesn't reintroduce the original unbounded
    // loop or over-correct into "3 retries and you're out".
    expect(MAX_OP_ATTEMPTS).toBeGreaterThanOrEqual(4);
    expect(MAX_OP_ATTEMPTS).toBeLessThanOrEqual(16);
  });

  it("declares MAX_OP_ATTEMPTS at module scope, not inside a function", () => {
    // The runner and the queue review UI both import this
    // constant — if someone inlines it into markOpFailed we
    // lose the ability to display "X of Y attempts used" on
    // /offline/queue.
    expect(source).toMatch(/export\s+const\s+MAX_OP_ATTEMPTS\s*=\s*\d+\s*;/);
  });

  it("markOpFailed reads attemptCount against MAX_OP_ATTEMPTS", () => {
    // The cap is meaningless if nobody checks it. This pins the
    // comparison so a later "simplification" can't delete it.
    expect(source).toMatch(/attemptCount\s*>=\s*MAX_OP_ATTEMPTS/);
  });

  it("markOpFailed forces retryable outcomes to 'failed' at the cap", () => {
    // The critical correctness property: even when the caller
    // passes { retryable: true }, a capped row must not go back
    // to `pending`. The logical expression below is the one
    // that enforces it.
    expect(source).toMatch(
      /opts\.retryable\s*&&\s*!capReached\s*\?\s*"pending"\s*:\s*"failed"/,
    );
  });

  it("dead-lettered rows carry a diagnostic lastError tag", () => {
    // The review UI filters on this substring to distinguish
    // "DLQ'd — stop retrying" from "failed — maybe retry". A
    // rename of the marker string would silently break that
    // filter, so pin the phrase.
    expect(source).toMatch(/dead-lettered after/);
  });

  it("the comment block still cites §12.2 so future readers find the audit line", () => {
    // Cheap check: if someone rewrites the docstring and drops
    // the cite, the trail from CI failure → audit → rationale
    // gets lost.
    expect(source).toMatch(/§12\.2/);
  });
});
