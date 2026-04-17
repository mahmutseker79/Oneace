// Pure-function tests for the compact relative-time formatter.

import { describe, expect, it } from "vitest";

import { formatRelative } from "./format-relative";

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

function hoursAgo(n: number): Date {
  return new Date(Date.now() - n * 60 * 60 * 1000);
}

function minutesAgo(n: number): Date {
  return new Date(Date.now() - n * 60 * 1000);
}

describe("formatRelative", () => {
  it("returns 'just now' for < 60 seconds", () => {
    const now = new Date();
    const thirtySecsAgo = new Date(now.getTime() - 30_000);
    expect(formatRelative(thirtySecsAgo, now)).toBe("just now");
  });

  it("returns minutes for 1–59 minutes", () => {
    const now = new Date();
    expect(formatRelative(minutesAgo(1), now)).toBe("1m ago");
    expect(formatRelative(minutesAgo(5), now)).toBe("5m ago");
    expect(formatRelative(minutesAgo(59), now)).toBe("59m ago");
  });

  it("returns hours for 1–23 hours", () => {
    const now = new Date();
    expect(formatRelative(hoursAgo(1), now)).toBe("1h ago");
    expect(formatRelative(hoursAgo(6), now)).toBe("6h ago");
    expect(formatRelative(hoursAgo(23), now)).toBe("23h ago");
  });

  it("returns days for 1–29 days", () => {
    const now = new Date();
    expect(formatRelative(daysAgo(1), now)).toBe("1d ago");
    expect(formatRelative(daysAgo(7), now)).toBe("7d ago");
    expect(formatRelative(daysAgo(29), now)).toBe("29d ago");
  });

  it("returns a locale date string for ≥ 30 days", () => {
    const now = new Date();
    const result = formatRelative(daysAgo(31), now);
    // Should NOT contain "ago" — should be a formatted date
    expect(result).not.toMatch(/ago/);
    expect(result.length).toBeGreaterThan(3);
  });

  it("accepts an explicit 'now' reference for deterministic tests", () => {
    const fixedNow = new Date("2025-06-01T12:00:00Z");
    const fiveMinsBefore = new Date("2025-06-01T11:55:00Z");
    expect(formatRelative(fiveMinsBefore, fixedNow)).toBe("5m ago");
  });
});
