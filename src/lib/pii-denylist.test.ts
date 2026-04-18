// P3-3 bonus (audit v1.1 §7.4) — PII denylist guard.
//
// The track() facade in `src/lib/instrumentation.ts` now scrubs a
// known set of PII keys from every event's props before fan-out.
// Two invariants pinned here:
//
//   1. The `PII_DENYLIST` constant covers the common foot-gun keys
//      (email, phone, password, token, ssn, credit card, address,
//      first/last name, DOB, IP). Adding new keys is fine; removing
//      any of these requires updating the test AND justifying the
//      removal.
//   2. `scrubPII()` replaces denied values with a redaction string
//      and passes through benign keys. `track()` applies scrubPII
//      before dispatching to every sink — tests observe the
//      scrubbed payload via a registered test sink.
//
// No DOM / Prisma / env — pure unit test over instrumentation.ts.

import {
  PII_DENYLIST,
  __clearTestSinks,
  __registerTestSink,
  scrubPII,
  track,
} from "@/lib/instrumentation";
import { afterEach, describe, expect, it } from "vitest";

describe("P3-3 §7.4 — PII denylist coverage", () => {
  const REQUIRED_KEYS = [
    "email",
    "phone",
    "password",
    "token",
    "apikey",
    "secret",
    "ssn",
    "cardnumber",
    "cvv",
    "address",
    "firstname",
    "lastname",
    "dob",
    "ip",
  ];
  for (const key of REQUIRED_KEYS) {
    it(`denies '${key}'`, () => {
      expect(
        PII_DENYLIST.includes(key),
        `PII_DENYLIST must include '${key}' — this is a common foot-gun field`,
      ).toBe(true);
    });
  }
});

describe("P3-3 §7.4 — scrubPII behaviour", () => {
  it("redacts denied keys with the canonical marker", () => {
    const out = scrubPII({ email: "a@b.com", plan: "PRO" });
    expect(out?.email).toBe("[redacted:key-denied]");
    expect(out?.plan).toBe("PRO");
  });

  it("matches keys case-insensitively after normalization", () => {
    const out = scrubPII({
      Email: "a@b.com",
      phoneNumber: "555-1212",
      CreditCard: "4111",
      "first-name": "Mahmut",
    });
    expect(out?.Email).toBe("[redacted:key-denied]");
    expect(out?.phoneNumber).toBe("[redacted:key-denied]");
    expect(out?.CreditCard).toBe("[redacted:key-denied]");
    expect(out?.["first-name"]).toBe("[redacted:key-denied]");
  });

  it("passes through benign keys untouched", () => {
    const input = { plan: "PRO", count: 3, ok: true, nested: { email: "still here" } };
    const out = scrubPII(input);
    expect(out).toEqual(input);
    // The nested object is intentionally NOT walked — callers must
    // flatten first. Asserting this prevents a future refactor from
    // quietly changing the contract.
    expect((out as { nested: { email: string } })?.nested.email).toBe("still here");
  });

  it("returns the same reference when nothing is denied (cheap path)", () => {
    const input = { plan: "PRO" };
    expect(scrubPII(input)).toBe(input);
  });

  it("handles undefined props without throwing", () => {
    expect(scrubPII(undefined)).toBeUndefined();
  });
});

describe("P3-3 §7.4 — track() applies scrubPII before fan-out", () => {
  afterEach(() => {
    __clearTestSinks();
  });

  it("test sinks see the scrubbed props, not the raw props", () => {
    const seen: Array<{ event: string; props: unknown }> = [];
    __registerTestSink((event, props) => {
      seen.push({ event, props });
    });

    track("user.invited", {
      email: "a@b.com",
      inviteCode: "abc123",
    });

    expect(seen).toHaveLength(1);
    expect(seen[0].event).toBe("user.invited");
    expect((seen[0].props as Record<string, unknown>).email).toBe("[redacted:key-denied]");
    // Non-denied keys survive.
    expect((seen[0].props as Record<string, unknown>).inviteCode).toBe("abc123");
  });

  it("track() does not mutate the caller's props object", () => {
    const props = { email: "a@b.com", plan: "PRO" };
    track("test.event", props);
    expect(props.email).toBe("a@b.com");
  });
});
