/**
 * Audit v1.1 §5.28 — Resend webhook signature verification.
 *
 * Resend uses Svix-style signatures. The incoming delivery carries:
 *
 *   svix-id         unique delivery id
 *   svix-timestamp  unix seconds when Svix signed the payload
 *   svix-signature  space-separated list of `<version>,<base64(mac)>`
 *
 * The signed string is `${svix_id}.${svix_timestamp}.${rawBody}` and
 * the MAC is HMAC-SHA256 keyed by the webhook's signing secret (which
 * Resend prefixes with `whsec_` when copied from their dashboard — we
 * strip that prefix before decoding).
 *
 * We implement verification by hand instead of pulling in the `svix`
 * npm package for the same reasons ResendMailer skips the official
 * SDK: bundle weight, supply-chain surface, and upgrade cadence. The
 * contract here is small (two versions: `v1`) and documented.
 *
 * Security properties we preserve:
 *   - Timing-safe comparison (avoid MAC-oracle timing attacks).
 *   - Timestamp tolerance: reject deliveries older than 5 minutes
 *     so a leaked body + signature can't be replayed forever.
 *   - Multiple signature versions in the header are OR-ed; we accept
 *     the delivery if ANY valid version matches (future-proof for
 *     when Svix rotates algorithms).
 */

import { createHmac, timingSafeEqual } from "node:crypto";

/** Max clock skew we'll accept between Svix's clock and ours. */
export const SVIX_TOLERANCE_SECONDS = 5 * 60;

export type ResendWebhookHeaders = {
  /** `svix-id` header — unique per delivery. */
  id: string | null;
  /** `svix-timestamp` header — unix seconds as a decimal string. */
  timestamp: string | null;
  /** `svix-signature` header — space-separated `<ver>,<base64mac>` tokens. */
  signature: string | null;
};

export type VerifyResult = { ok: true } | { ok: false; reason: string };

/**
 * Verify a Resend (Svix) webhook delivery.
 *
 * @param headers  the trio of `svix-*` headers, unmodified
 * @param rawBody  the raw request body as received (do NOT JSON-reparse)
 * @param secret   the signing secret from Resend dashboard (with or
 *                 without the `whsec_` prefix)
 * @param now      clock to compare `svix-timestamp` against — defaults
 *                 to `new Date()`; pass fixed Date in tests.
 */
export function verifyResendWebhook(
  headers: ResendWebhookHeaders,
  rawBody: string,
  secret: string,
  now: Date = new Date(),
): VerifyResult {
  if (!headers.id || !headers.timestamp || !headers.signature) {
    return { ok: false, reason: "missing svix-* headers" };
  }

  // Replay window check — a delivery older than SVIX_TOLERANCE_SECONDS
  // (or dated in the future by more than the same window) is rejected.
  const ts = Number.parseInt(headers.timestamp, 10);
  if (Number.isNaN(ts)) {
    return { ok: false, reason: "svix-timestamp not an integer" };
  }
  const nowSec = Math.floor(now.getTime() / 1000);
  if (Math.abs(nowSec - ts) > SVIX_TOLERANCE_SECONDS) {
    return {
      ok: false,
      reason: `svix-timestamp outside ±${SVIX_TOLERANCE_SECONDS}s tolerance`,
    };
  }

  // Decode the signing secret. Resend copies from dashboard look like
  // `whsec_<base64>`, so strip the prefix if present.
  const rawSecret = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  let keyBytes: Buffer;
  try {
    keyBytes = Buffer.from(rawSecret, "base64");
  } catch {
    return { ok: false, reason: "signing secret not base64-decodable" };
  }
  if (keyBytes.length === 0) {
    return { ok: false, reason: "signing secret decoded to empty bytes" };
  }

  // Compose the signed payload as Svix does: `${id}.${ts}.${body}`.
  const signed = `${headers.id}.${headers.timestamp}.${rawBody}`;
  const expected = createHmac("sha256", keyBytes).update(signed).digest();

  // `svix-signature` is a space-separated list of `v1,<base64>` tokens.
  // Split, filter to the versions we know how to verify, base64-decode,
  // and timing-safe-compare to our expected digest.
  const candidates = headers.signature.split(" ").filter((s) => s.length > 0);
  for (const token of candidates) {
    const commaIdx = token.indexOf(",");
    if (commaIdx < 0) continue;
    const version = token.slice(0, commaIdx);
    if (version !== "v1") continue; // only v1 today; extend as Svix rotates
    const macBase64 = token.slice(commaIdx + 1);
    let macBytes: Buffer;
    try {
      macBytes = Buffer.from(macBase64, "base64");
    } catch {
      continue;
    }
    if (macBytes.length !== expected.length) continue;
    if (timingSafeEqual(macBytes, expected)) {
      return { ok: true };
    }
  }

  return { ok: false, reason: "no matching v1 signature" };
}

/**
 * Resend webhook event types we care about. The wire payload has many
 * more (`email.sent`, `email.delivered`, `email.opened`, …) but only
 * these four move deliverability state.
 */
export const RESEND_STATE_CHANGING_EVENTS = [
  "email.bounced",
  "email.complained",
  "email.unsubscribed",
] as const;
export type ResendStateChangingEvent = (typeof RESEND_STATE_CHANGING_EVENTS)[number];

/** Map a Resend event type to the User.emailStatus transition. */
export function resendEventToStatus(
  event: ResendStateChangingEvent,
): "BOUNCED" | "COMPLAINED" | "UNSUBSCRIBED" {
  switch (event) {
    case "email.bounced":
      return "BOUNCED";
    case "email.complained":
      return "COMPLAINED";
    case "email.unsubscribed":
      return "UNSUBSCRIBED";
  }
}
