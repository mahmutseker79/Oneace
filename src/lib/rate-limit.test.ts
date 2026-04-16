// Phase 6B / Item 2 — pure-function tests for the rate-limit helper.
//
// Scope: in-process MEMORY backend only. The Upstash REST path is
// network-dependent and explicitly out of scope for this phase (no
// mocks, no fake servers). These tests rely on the setup file not
// setting UPSTASH_REDIS_REST_URL/TOKEN, which keeps `hasUpstash`
// false at module load and routes rateLimit() through `checkMemory`.
//
// The regression floor we want here is behavioural, not structural:
// "allowed-then-denied", "isolated keys", "reset-between-tests
// actually resets". If anyone accidentally breaks the fixed-window
// accounting or the test escape hatch, these tests fail loudly.

import { afterEach, describe, expect, it } from "vitest";

import { RATE_LIMITS, __resetMemoryBucketsForTest, rateLimit } from "./rate-limit";

afterEach(() => {
  __resetMemoryBucketsForTest();
});

describe("rateLimit (in-process memory backend)", () => {
  it("allows exactly `max` operations and denies the next one", async () => {
    const key = "test:allow-then-deny";
    const limit = { max: 3, windowSeconds: 60 };

    const first = await rateLimit(key, limit);
    expect(first.ok).toBe(true);
    expect(first.remaining).toBe(2);
    expect(first.limit).toBe(3);

    const second = await rateLimit(key, limit);
    expect(second.ok).toBe(true);
    expect(second.remaining).toBe(1);

    const third = await rateLimit(key, limit);
    expect(third.ok).toBe(true);
    expect(third.remaining).toBe(0);

    const fourth = await rateLimit(key, limit);
    expect(fourth.ok).toBe(false);
    expect(fourth.remaining).toBe(0);
    expect(fourth.limit).toBe(3);
  });

  it("segregates buckets by key", async () => {
    const limit = { max: 1, windowSeconds: 60 };
    const a = await rateLimit("test:key-a", limit);
    const b = await rateLimit("test:key-b", limit);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);

    // Each key is now exhausted independently.
    const aAgain = await rateLimit("test:key-a", limit);
    expect(aAgain.ok).toBe(false);
  });

  it("__resetMemoryBucketsForTest clears state for the next test", async () => {
    const key = "test:reset-between";
    const limit = { max: 1, windowSeconds: 60 };

    const allowed = await rateLimit(key, limit);
    expect(allowed.ok).toBe(true);
    const denied = await rateLimit(key, limit);
    expect(denied.ok).toBe(false);

    __resetMemoryBucketsForTest();

    const afterReset = await rateLimit(key, limit);
    expect(afterReset.ok).toBe(true);
  });

  it("returns a reset timestamp roughly windowSeconds in the future", async () => {
    const limit = { max: 1, windowSeconds: 60 };
    const before = Math.floor(Date.now() / 1000);
    const result = await rateLimit("test:reset-ts", limit);
    // Allow a one-second slack for clock jitter between our `before`
    // sample and the helper's internal `Math.floor(Date.now()/1000)`.
    expect(result.reset).toBeGreaterThanOrEqual(before);
    expect(result.reset).toBeLessThanOrEqual(before + 60 + 1);
  });

  it("enforces RATE_LIMITS.twoFactor profile", async () => {
    const limit = RATE_LIMITS.twoFactor;
    const key = "auth:two_factor:user:test123";

    // Should allow 5 attempts
    for (let i = 0; i < 5; i++) {
      const result = await rateLimit(key, limit);
      expect(result.ok).toBe(true);
    }

    // 6th attempt should be denied
    const denied = await rateLimit(key, limit);
    expect(denied.ok).toBe(false);
  });

  it("enforces RATE_LIMITS.login profile", async () => {
    const limit = RATE_LIMITS.login;
    const key = "auth:login:ip:192.168.1.1";

    // Should allow 5 attempts
    for (let i = 0; i < 5; i++) {
      const result = await rateLimit(key, limit);
      expect(result.ok).toBe(true);
    }

    // 6th attempt should be denied
    const denied = await rateLimit(key, limit);
    expect(denied.ok).toBe(false);
  });

  it("enforces RATE_LIMITS.register profile", async () => {
    const limit = RATE_LIMITS.register;
    const key = "auth:register:ip:192.168.1.1";

    // Should allow 3 attempts
    for (let i = 0; i < 3; i++) {
      const result = await rateLimit(key, limit);
      expect(result.ok).toBe(true);
    }

    // 4th attempt should be denied
    const denied = await rateLimit(key, limit);
    expect(denied.ok).toBe(false);
  });
});
