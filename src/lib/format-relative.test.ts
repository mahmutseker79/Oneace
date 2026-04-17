// Pure-function tests for the compact relative-time formatter.

import { describe, expect, it } from "vitest";

import { formatRelative } from "./format-relative";

// Use a fixed reference so the past-timestamp helpers don't drift
// from `now` by the microseconds of clock advance between calls
// (which would make floor(diff/day) round down on a fresh CI runner).
const NOW = new Date("2026-01-15T12:00:00Z");
const NOW_MS = NOW.getTime();

function daysAgo(n: number): Date {
  return new Date(NOW_MS - n * 24 * 60 * 60 * 1000);
}

function hoursAgo(n: number): Date {
  return new Date(NOW_MS - n * 60 * 60 * 1000);
}

function minutesAgo(n: number): Date {
  return new Date(NOW_MS - n * 60 * 1000);
}

describe("formatRelative", () => {
  it("returns 'just now' for < 60 seconds", () => {
    const thirtySecsAgo = new Date(NOW_MS - 30_000);
    expect(formatRelative(thirtySecsAgo, NOW)).toBe("just now");
  });

  it("returns minutes for 1–59 minutes", () => {
    expect(formatRelative(minutesAgo(1), NOW)).toBe("1m ago");
    expect(formatRelative(minutesAgo(5), NOW)).toBe("5m ago");
    expect(formatRelative(minutesAgo(59), NOW)).toBe("59m ago");
  });

  it("returns hours for 1–23 hours", () => {
    expect(formatRelative(hoursAgo(1), NOW)).toBe("1h ago");
    expect(formatRelative(hoursAgo(6), NOW)).toBe("6h ago");
    expect(formatRelative(hoursAgo(23), NOW)).toBe("23h ago");
  });

  it("returns days for 1–29 days", () => {
    expect(formatRelative(daysAgo(1), NOW)).toBe("1d ago");
    expect(formatRelative(daysAgo(7), NOW)).toBe("7d ago");
    expect(formatRelative(daysAgo(29), NOW)).toBe("29d ago");
  });

  it("returns a locale date string for ≥ 30 days", () => {
    const result = formatRelative(daysAgo(31), NOW);
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
