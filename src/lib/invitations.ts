/**
 * Sprint 20: invitation token + URL helpers.
 *
 * Tokens are 32 random bytes (256 bits) encoded as url-safe base64,
 * which yields 43 characters of opaque entropy. That's way beyond
 * anything a brute force could chew through inside the 14-day default
 * TTL — the probability of guessing a live token in a billion years
 * of continuous guessing is still astronomically small.
 *
 * We intentionally avoid cuid/short tokens: the token is a capability,
 * and capabilities need to be unguessable even when an attacker knows
 * the organization and the invited email address.
 */

import { randomBytes } from "node:crypto";

import { env } from "@/lib/env";

/** How long an invitation lives before it expires. */
export const INVITATION_TTL_DAYS = 14;

/**
 * Generate a fresh capability token for an invitation. The caller is
 * responsible for storing it on the `Invitation` row.
 */
export function generateInvitationToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Compute the absolute URL that the admin will copy/paste into their
 * own email, Slack, WhatsApp, etc. We read `NEXT_PUBLIC_APP_URL` so
 * that dev, staging, and prod each mint URLs on their own hostname;
 * if it's unset, fall back to localhost so tests and local dev just
 * work.
 */
export function buildInvitationUrl(token: string): string {
  // Sprint 37: `env.NEXT_PUBLIC_APP_URL` is already the trimmed,
  // validated URL (or `undefined` when unset in local dev). We
  // still keep the trailing-slash scrub because environments vary.
  const base = (env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/invite/${token}`;
}

/** Current expiry for a freshly-minted invitation. */
export function defaultInvitationExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * Status of an invitation row as seen by the acceptor. Central enum so
 * the accept page and the actions agree on how to classify an
 * invitation.
 */
export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";

export function classifyInvitation(invite: {
  acceptedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date;
}): InvitationStatus {
  if (invite.acceptedAt) return "accepted";
  if (invite.revokedAt) return "revoked";
  if (invite.expiresAt.getTime() <= Date.now()) return "expired";
  return "pending";
}
