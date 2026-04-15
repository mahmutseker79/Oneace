// Phase 6B / Item 2 — pure-function tests for invitation helpers.
//
// Scope: token shape, URL shape, expiry arithmetic, classifyInvitation
// truth table. Deliberately NO database, NO network, NO mocks — the
// module is a handful of pure helpers and the regression floor we
// want is "nobody accidentally changes a token length or an expiry
// window without a failing test surfacing it".

import { describe, expect, it } from "vitest";

import {
  INVITATION_TTL_DAYS,
  buildInvitationUrl,
  classifyInvitation,
  defaultInvitationExpiry,
  generateInvitationToken,
} from "./invitations";

describe("generateInvitationToken", () => {
  it("returns 43 characters of url-safe base64 entropy", () => {
    const token = generateInvitationToken();
    // 32 random bytes → base64url → 43 chars (no padding).
    expect(token).toHaveLength(43);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("returns a different token on each call", () => {
    const a = generateInvitationToken();
    const b = generateInvitationToken();
    expect(a).not.toEqual(b);
  });
});

describe("buildInvitationUrl", () => {
  it("builds an /invite/<token> URL on the configured host", () => {
    const url = buildInvitationUrl("abc123");
    expect(url).toMatch(/^https?:\/\/[^/]+\/invite\/abc123$/);
  });
});

describe("defaultInvitationExpiry", () => {
  it("returns a date INVITATION_TTL_DAYS in the future", () => {
    const now = new Date("2026-04-12T00:00:00.000Z");
    const expiry = defaultInvitationExpiry(now);
    const deltaMs = expiry.getTime() - now.getTime();
    expect(deltaMs).toBe(INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
  });
});

describe("classifyInvitation", () => {
  const future = new Date(Date.now() + 60_000);
  const past = new Date(Date.now() - 60_000);

  it("returns 'accepted' when acceptedAt is set (takes precedence over revoked/expired)", () => {
    expect(
      classifyInvitation({ acceptedAt: new Date(), revokedAt: new Date(), expiresAt: past }),
    ).toBe("accepted");
  });

  it("returns 'revoked' when revokedAt is set and not accepted", () => {
    expect(classifyInvitation({ acceptedAt: null, revokedAt: new Date(), expiresAt: future })).toBe(
      "revoked",
    );
  });

  it("returns 'expired' when expiresAt is in the past", () => {
    expect(classifyInvitation({ acceptedAt: null, revokedAt: null, expiresAt: past })).toBe(
      "expired",
    );
  });

  it("returns 'pending' when not accepted, not revoked, not expired", () => {
    expect(classifyInvitation({ acceptedAt: null, revokedAt: null, expiresAt: future })).toBe(
      "pending",
    );
  });
});
