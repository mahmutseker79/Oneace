/**
 * Unit tests for the cron parser and trigger evaluation logic.
 *
 * The cron implementation uses local time (Date.getHours etc.), so tests
 * create dates via `new Date(year, month, date, hours, minutes)` to stay
 * timezone-agnostic.
 */

import { describe, expect, it } from "vitest";

import { calculateNextRun, evaluateTrigger, parseCron } from "./triggers";

// Helpers to construct local-time dates quickly.
function local(y: number, m: number, d: number, h = 0, min = 0): Date {
  return new Date(y, m - 1, d, h, min, 0, 0); // month is 0-indexed
}

// ---------------------------------------------------------------------------
// parseCron — supported patterns
// ---------------------------------------------------------------------------

describe("parseCron — supported patterns", () => {
  it("daily at 03:30 → { minute: 30, hour: 3, dom: null, dow: null }", () => {
    expect(parseCron("30 3 * * *")).toEqual({ minute: 30, hour: 3, dom: null, dow: null });
  });

  it("weekly Monday at 09:00 → dow: 1", () => {
    expect(parseCron("0 9 * * 1")).toEqual({ minute: 0, hour: 9, dom: null, dow: 1 });
  });

  it("weekly Sunday at 18:00 → dow: 0", () => {
    expect(parseCron("0 18 * * 0")).toEqual({ minute: 0, hour: 18, dom: null, dow: 0 });
  });

  it("monthly 1st at midnight → dom: 1", () => {
    expect(parseCron("0 0 1 * *")).toEqual({ minute: 0, hour: 0, dom: 1, dow: null });
  });

  it("monthly 15th at 14:00 → dom: 15", () => {
    expect(parseCron("0 14 15 * *")).toEqual({ minute: 0, hour: 14, dom: 15, dow: null });
  });
});

describe("parseCron — rejected patterns", () => {
  it("empty string → null", () => expect(parseCron("")).toBeNull());
  it("too few fields → null", () => expect(parseCron("30 3 * *")).toBeNull());
  it("too many fields → null", () => expect(parseCron("30 3 * * * *")).toBeNull());
  it("minute out of range (60) → null", () => expect(parseCron("60 3 * * *")).toBeNull());
  it("hour out of range (25) → null", () => expect(parseCron("0 25 * * *")).toBeNull());
  it("wildcard minute (* 9 * * *) → null", () => expect(parseCron("* 9 * * *")).toBeNull());
  it("wildcard hour (0 * * * *) → null", () => expect(parseCron("0 * * * *")).toBeNull());
  it("step (*/15) → null", () => expect(parseCron("*/15 * * * *")).toBeNull());
  it("range (1-5) → null", () => expect(parseCron("0 9 * * 1-5")).toBeNull());
  it("comma list (0,30) → null", () => expect(parseCron("0,30 9 * * *")).toBeNull());
  it("both dom and dow → null", () => expect(parseCron("0 9 15 * 1")).toBeNull());
  it("specific month → null", () => expect(parseCron("0 9 * 3 *")).toBeNull());
});

// ---------------------------------------------------------------------------
// calculateNextRun — uses local time
// ---------------------------------------------------------------------------

describe("calculateNextRun", () => {
  it("daily at 03:30 — same day if from is before 03:30", () => {
    const from = local(2026, 4, 16, 2, 0); // 02:00
    const next = calculateNextRun("30 3 * * *", from);
    expect(next).not.toBeNull();
    expect(next?.getHours()).toBe(3);
    expect(next?.getMinutes()).toBe(30);
    expect(next?.getDate()).toBe(16);
  });

  it("daily at 03:30 — next day if from is after 03:30", () => {
    const from = local(2026, 4, 16, 5, 0); // 05:00
    const next = calculateNextRun("30 3 * * *", from);
    expect(next).not.toBeNull();
    expect(next?.getDate()).toBe(17);
    expect(next?.getHours()).toBe(3);
    expect(next?.getMinutes()).toBe(30);
  });

  it("weekly Monday 09:00 — skips to next Monday", () => {
    // 2026-04-13 is Monday. from = Mon 10:00 → next = Apr 20 Mon 09:00.
    const from = local(2026, 4, 13, 10, 0);
    expect(from.getDay()).toBe(1); // sanity: it's Monday
    const next = calculateNextRun("0 9 * * 1", from);
    expect(next).not.toBeNull();
    expect(next?.getDay()).toBe(1); // Monday
    expect(next?.getDate()).toBe(20);
    expect(next?.getHours()).toBe(9);
  });

  it("monthly 1st at midnight — wraps to next month", () => {
    const from = local(2026, 4, 2, 0, 0); // April 2
    const next = calculateNextRun("0 0 1 * *", from);
    expect(next).not.toBeNull();
    expect(next?.getMonth()).toBe(4); // 0-indexed → May
    expect(next?.getDate()).toBe(1);
  });

  it("monthly 1st at midnight — same month if from is before", () => {
    const from = local(2026, 3, 31, 23, 0); // March 31 23:00
    const next = calculateNextRun("0 0 1 * *", from);
    expect(next).not.toBeNull();
    expect(next?.getMonth()).toBe(3); // 0-indexed → April
    expect(next?.getDate()).toBe(1);
  });

  it("invalid cron → null", () => {
    expect(calculateNextRun("bad", new Date())).toBeNull();
  });

  it("result is always strictly after from", () => {
    const from = local(2026, 4, 16, 3, 30); // exactly on a match
    const next = calculateNextRun("30 3 * * *", from);
    expect(next).not.toBeNull();
    expect(next?.getTime()).toBeGreaterThan(from.getTime());
  });
});

// ---------------------------------------------------------------------------
// evaluateTrigger
// ---------------------------------------------------------------------------

describe("evaluateTrigger", () => {
  const base = {
    id: "tpl_1",
    name: "Test Template",
    organizationId: "org_1",
    isRecurring: true,
    cronExpression: "0 9 * * *" as string | null,
    lastUsedAt: null as Date | null,
  };

  it("should trigger when now > nextScheduledAt", () => {
    const template = {
      ...base,
      nextScheduledAt: local(2026, 4, 16, 9, 0),
    };
    const now = local(2026, 4, 16, 9, 1);
    const result = evaluateTrigger(template, now);
    expect(result.shouldTrigger).toBe(true);
    expect(result.reason).toBeTruthy();
    expect(result.nextRunAt).not.toBeNull();
  });

  it("should NOT trigger when now < nextScheduledAt", () => {
    const template = {
      ...base,
      nextScheduledAt: local(2026, 4, 17, 9, 0),
    };
    const now = local(2026, 4, 16, 10, 0);
    const result = evaluateTrigger(template, now);
    expect(result.shouldTrigger).toBe(false);
  });

  it("should trigger when nextScheduledAt is null (first run)", () => {
    const template = { ...base, nextScheduledAt: null as Date | null };
    const now = local(2026, 4, 16, 10, 0);
    const result = evaluateTrigger(template, now);
    expect(result.shouldTrigger).toBe(true);
  });

  it("should NOT trigger if isRecurring is false", () => {
    const template = {
      ...base,
      isRecurring: false,
      nextScheduledAt: local(2026, 4, 16, 9, 0),
    };
    const now = local(2026, 4, 16, 9, 5);
    const result = evaluateTrigger(template, now);
    expect(result.shouldTrigger).toBe(false);
  });

  it("should NOT trigger if cronExpression is null", () => {
    const template = {
      ...base,
      cronExpression: null as string | null,
      nextScheduledAt: local(2026, 4, 16, 9, 0),
    };
    const now = local(2026, 4, 16, 9, 5);
    const result = evaluateTrigger(template, now);
    expect(result.shouldTrigger).toBe(false);
  });

  it("nextRunAt in result points to the NEXT occurrence", () => {
    const template = {
      ...base,
      nextScheduledAt: local(2026, 4, 16, 9, 0),
    };
    const now = local(2026, 4, 16, 9, 5);
    const result = evaluateTrigger(template, now);
    expect(result.shouldTrigger).toBe(true);
    // Next occurrence should be April 17 at 09:00
    expect(result.nextRunAt?.getDate()).toBe(17);
    expect(result.nextRunAt?.getHours()).toBe(9);
  });

  it("lag guard: does not re-fire if lastUsedAt matches scheduled window", () => {
    const scheduled = local(2026, 4, 16, 9, 0);
    const template = {
      ...base,
      nextScheduledAt: scheduled,
      lastUsedAt: new Date(scheduled.getTime() + 5_000),
    };
    const now = local(2026, 4, 16, 9, 2);
    const result = evaluateTrigger(template, now);
    expect(result.shouldTrigger).toBe(false);
    expect(result.reason).toMatch(/already fired/i);
  });
});
