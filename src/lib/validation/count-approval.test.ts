// src/lib/validation/count-approval.test.ts
//
// GOD MODE roadmap 2026-04-23 — P1-03 test coverage ratchet.
//
// Zod-schema coverage for the stock-count approval lifecycle:
// submit → approve | reject → optional rollback. Pure schema; 100%
// coverage achievable from this file alone.

import { describe, expect, it } from "vitest";

import {
  approveCountSchema,
  rejectCountSchema,
  rollbackCountSchema,
  submitForApprovalSchema,
} from "./count-approval";

describe("submitForApprovalSchema", () => {
  it("accepts a valid countId", () => {
    expect(submitForApprovalSchema.safeParse({ countId: "c_1" }).success).toBe(true);
  });
  it("rejects empty countId", () => {
    expect(submitForApprovalSchema.safeParse({ countId: "" }).success).toBe(false);
  });
  it("empty comment normalises to null", () => {
    const r = submitForApprovalSchema.safeParse({ countId: "c_1", comment: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.comment).toBeNull();
  });
  it("accepts comment up to 1000 chars", () => {
    const r = submitForApprovalSchema.safeParse({
      countId: "c_1",
      comment: "x".repeat(1000),
    });
    expect(r.success).toBe(true);
  });
  it("rejects comment over 1000 chars", () => {
    const r = submitForApprovalSchema.safeParse({
      countId: "c_1",
      comment: "x".repeat(1001),
    });
    expect(r.success).toBe(false);
  });
});

describe("approveCountSchema", () => {
  it("accepts valid payload", () => {
    expect(approveCountSchema.safeParse({ countId: "c_1" }).success).toBe(true);
  });
  it("rejects missing countId", () => {
    expect(approveCountSchema.safeParse({}).success).toBe(false);
  });
});

describe("rejectCountSchema — comment REQUIRED (unlike submit/approve)", () => {
  it("accepts with non-empty comment", () => {
    const r = rejectCountSchema.safeParse({
      countId: "c_1",
      comment: "Not enough evidence",
    });
    expect(r.success).toBe(true);
  });

  it("rejects empty comment (rejections must explain themselves)", () => {
    const r = rejectCountSchema.safeParse({ countId: "c_1", comment: "" });
    expect(r.success).toBe(false);
  });

  it("rejects whitespace-only comment", () => {
    const r = rejectCountSchema.safeParse({ countId: "c_1", comment: "   " });
    expect(r.success).toBe(false);
  });

  it("rejects comment longer than 1000 chars", () => {
    const r = rejectCountSchema.safeParse({
      countId: "c_1",
      comment: "y".repeat(1001),
    });
    expect(r.success).toBe(false);
  });
});

describe("rollbackCountSchema — reason REQUIRED", () => {
  it("accepts a valid rollback", () => {
    const r = rollbackCountSchema.safeParse({
      countId: "c_1",
      reason: "Duplicate count — original stands",
    });
    expect(r.success).toBe(true);
  });

  it("rejects empty reason", () => {
    expect(rollbackCountSchema.safeParse({ countId: "c_1", reason: "" }).success).toBe(false);
  });

  it("rejects reason longer than 1000 chars", () => {
    const r = rollbackCountSchema.safeParse({
      countId: "c_1",
      reason: "z".repeat(1001),
    });
    expect(r.success).toBe(false);
  });
});
