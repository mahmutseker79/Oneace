// Pure-function tests for the safe-redirect validator.
// isSafeRedirect is security-critical (open-redirect prevention) —
// these tests form the regression floor for that contract.

import { describe, expect, it } from "vitest";

import { isSafeRedirect, resolveSafeRedirect } from "./redirects";

describe("isSafeRedirect", () => {
  it("accepts normal relative paths", () => {
    expect(isSafeRedirect("/dashboard")).toBe(true);
    expect(isSafeRedirect("/items/abc-123")).toBe(true);
    expect(isSafeRedirect("/purchase-orders?page=2")).toBe(true);
    expect(isSafeRedirect("/invite/tok_abc123")).toBe(true);
  });

  it("rejects absolute URLs (cross-origin redirect)", () => {
    expect(isSafeRedirect("https://evil.example/phish")).toBe(false);
    expect(isSafeRedirect("http://localhost:3000/dashboard")).toBe(false);
  });

  it("rejects protocol-relative URLs (// prefix)", () => {
    expect(isSafeRedirect("//evil.example")).toBe(false);
    expect(isSafeRedirect("//dashboard")).toBe(false);
  });

  it("rejects paths containing backslash (Windows-separator bypass)", () => {
    expect(isSafeRedirect("/dashboard\\evil")).toBe(false);
    expect(isSafeRedirect("\\evil")).toBe(false);
  });

  it("rejects paths containing @ (userinfo injection)", () => {
    expect(isSafeRedirect("/@evil.example")).toBe(false);
    expect(isSafeRedirect("/user@host")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isSafeRedirect("")).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(isSafeRedirect(null)).toBe(false);
    expect(isSafeRedirect(undefined)).toBe(false);
    expect(isSafeRedirect(42)).toBe(false);
    expect(isSafeRedirect([])).toBe(false);
  });

  it("rejects paths with control characters (newline / tab injection)", () => {
    expect(isSafeRedirect("/dashboard\nnewline")).toBe(false);
    expect(isSafeRedirect("/dashboard\r")).toBe(false);
    expect(isSafeRedirect("/dashboard\t")).toBe(false);
  });

  it("rejects paths over 512 characters", () => {
    const long = "/" + "a".repeat(512);
    expect(isSafeRedirect(long)).toBe(false);
    expect(isSafeRedirect("/" + "a".repeat(511))).toBe(true);
  });

  it("rejects paths that don't start with /", () => {
    expect(isSafeRedirect("dashboard")).toBe(false);
    expect(isSafeRedirect("relative/path")).toBe(false);
  });
});

describe("resolveSafeRedirect", () => {
  it("returns the path when safe", () => {
    expect(resolveSafeRedirect("/items")).toBe("/items");
    expect(resolveSafeRedirect("/invite/tok123")).toBe("/invite/tok123");
  });

  it("falls back to /dashboard for unsafe input", () => {
    expect(resolveSafeRedirect("https://evil.example")).toBe("/dashboard");
    expect(resolveSafeRedirect("//evil")).toBe("/dashboard");
    expect(resolveSafeRedirect(null)).toBe("/dashboard");
  });

  it("respects a custom fallback", () => {
    expect(resolveSafeRedirect("//evil", "/login")).toBe("/login");
    expect(resolveSafeRedirect(null, "/home")).toBe("/home");
  });
});
