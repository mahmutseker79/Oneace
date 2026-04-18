/**
 * @openapi-tag: /webhooks/resend
 *
 * P3-4 (audit v1.1 §5.32) — the tag above is the canonical route
 * path. docs/openapi.yaml MUST declare the same path with every
 * HTTP method this file exports. `src/lib/openapi-parity.test.ts`
 * pins the two in lockstep.
 */
/**
 * Audit v1.1 §5.28 — Resend (Svix) webhook endpoint.
 *
 * This is the receiver that Resend calls with `email.bounced`,
 * `email.complained`, and `email.unsubscribed` deliveries. Before
 * this route existed we had no persisted record of deliverability
 * trouble — the outbound mailer kept sending to dead addresses and
 * the sending-domain reputation suffered (Resend throttles at ~5%
 * invalid-send ratio).
 *
 * Contract with Resend/Svix:
 *   - POST only. Body is JSON, but we read the raw text for MAC
 *     verification — never `request.json()`, because even a
 *     re-serialised payload can drift (trailing newline, key order)
 *     from what Svix signed.
 *   - Headers `svix-id`, `svix-timestamp`, `svix-signature` are
 *     required; missing any of them → 400.
 *   - Timestamp outside ±5 minutes → 400 (replay window).
 *   - Bad MAC → 401.
 *   - Unknown but well-signed event → 200 with `{processed:false}`
 *     so Resend doesn't retry for events we've chosen to ignore.
 *   - 5xx is reserved for our own bugs; Resend's retry policy will
 *     re-deliver on 5xx, which is what we want for transient DB
 *     failures.
 *
 * Why not reuse `/api/webhooks/inbound`? That route is keyed on our
 * own `X-Webhook-*` headers and an internal `organizationId` shape.
 * Resend speaks Svix (different header names, different signing
 * payload, a single tenant). Sharing one route would have meant
 * branching deep inside the handler on header presence — clearer to
 * split and let each route stay focused.
 */

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import {
  RESEND_STATE_CHANGING_EVENTS,
  type ResendStateChangingEvent,
  resendEventToStatus,
  verifyResendWebhook,
} from "@/lib/mail/resend-webhook";
import { type NextRequest, NextResponse } from "next/server";

/** Guard against truly pathological bodies; Svix deliveries are small. */
const MAX_PAYLOAD_SIZE = 256 * 1024; // 256 KB — Resend payloads are <5KB.

/**
 * Shape of the inner JSON we care about. Resend wraps the event in a
 * `{type, data:{...}}` envelope; only `type` + `data.email` drive
 * state transitions, so we intentionally under-specify the rest.
 */
type ResendEnvelope = {
  type?: string;
  data?: {
    email_id?: string;
    to?: string | string[];
    email?: string; // some event types use `email` directly
  };
};

export async function POST(request: NextRequest) {
  // No secret configured → fail loud. Better than silently accepting
  // unsigned traffic just because someone forgot to set the env var.
  const secret = env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    logger.error(
      "Resend webhook received but RESEND_WEBHOOK_SECRET is not configured — rejecting",
    );
    return NextResponse.json(
      { error: "Webhook endpoint not configured" },
      { status: 503 },
    );
  }

  // Read raw body first — any JSON.parse before verify would be a
  // TOCTOU foot-gun if it ever started stripping whitespace.
  const rawBody = await request.text();
  if (rawBody.length > MAX_PAYLOAD_SIZE) {
    logger.warn("Resend webhook payload too large", { size: rawBody.length });
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  const verifyResult = verifyResendWebhook(
    {
      id: request.headers.get("svix-id"),
      timestamp: request.headers.get("svix-timestamp"),
      signature: request.headers.get("svix-signature"),
    },
    rawBody,
    secret,
  );

  if (!verifyResult.ok) {
    // Distinguish "your request is malformed" (400) from "your MAC
    // doesn't match" (401). Svix/Resend treat both as signals to
    // pause redelivery, so the split is mostly for our logs.
    const status =
      verifyResult.reason === "no matching v1 signature" ? 401 : 400;
    logger.warn("Resend webhook verification failed", {
      reason: verifyResult.reason,
      status,
    });
    return NextResponse.json({ error: verifyResult.reason }, { status });
  }

  let parsed: ResendEnvelope;
  try {
    parsed = JSON.parse(rawBody) as ResendEnvelope;
  } catch {
    logger.warn("Resend webhook JSON parse failed (post-verify)");
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const type = parsed.type ?? "";
  const isStateChanging = (
    RESEND_STATE_CHANGING_EVENTS as readonly string[]
  ).includes(type);
  if (!isStateChanging) {
    // Still ack — Resend treats non-2xx as a retry signal, and we
    // don't want retries for informational events (sent/delivered/
    // opened/clicked). `processed:false` is recorded for log hygiene.
    logger.info("Resend webhook ignored (non-state-changing)", { type });
    return NextResponse.json({ ok: true, processed: false, type });
  }

  // Pull the recipient email. Resend wire payloads use `to` (may be
  // string or array) on delivery events and `email` on unsubscribe;
  // normalize to a single lowercased address.
  const data = parsed.data ?? {};
  const candidate = data.email ?? data.to ?? "";
  const email = (Array.isArray(candidate) ? candidate[0] : candidate)
    ?.toString()
    .trim()
    .toLowerCase();

  if (!email) {
    logger.warn("Resend webhook missing recipient email", { type });
    // Still 200 — the signature was valid; the absent recipient is
    // either a Resend quirk or a malformed event on their side.
    return NextResponse.json({ ok: true, processed: false, type });
  }

  const status = resendEventToStatus(type as ResendStateChangingEvent);

  // Update the user's emailStatus. updateMany() is intentional:
  //   - If the email doesn't match a user (e.g. alias, test
  //     address), `count:0` — we log and return 200.
  //   - We don't want the handler to 500 when Resend bounces a
  //     message to an address we've since deleted, because that
  //     turns into a permanent retry storm.
  try {
    const result = await db.user.updateMany({
      where: { email },
      data: {
        emailStatus: status,
        emailStatusUpdatedAt: new Date(),
      },
    });
    logger.info("Resend webhook processed", {
      type,
      email,
      status,
      affected: result.count,
    });
    return NextResponse.json({
      ok: true,
      processed: true,
      type,
      status,
      affected: result.count,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    logger.error("Resend webhook DB update failed", { type, email, err: msg });
    // 5xx so Resend retries — transient DB errors should not lose
    // deliverability state.
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/** Resend's "test endpoint" button sends a HEAD; acknowledge. */
export async function HEAD() {
  return new Response(null, { status: 200 });
}
