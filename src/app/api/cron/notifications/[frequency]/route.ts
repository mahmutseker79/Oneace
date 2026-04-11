// Sprint 41 — cron-triggered notification fan-out.
//
// `GET /api/cron/notifications/daily`  → wakes the DAILY digest flow
// `GET /api/cron/notifications/weekly` → wakes the WEEKLY digest flow
//
// Authentication
// --------------
// This endpoint is called from a scheduler (Vercel Cron, GitHub Actions,
// an external cron runner — anything that can hit an HTTP URL on a
// cadence). It must reject any other caller with `401 Unauthorized`.
// We verify a shared secret on the `Authorization: Bearer …` header,
// compared against `env.CRON_SECRET`.
//
// If `CRON_SECRET` is not configured, the route returns `503 Service
// Unavailable` instead of silently processing: a missing secret is
// almost always a forgotten deployment variable, and we would rather
// alarm the operator than accidentally expose the notification fan-out
// on an open endpoint.
//
// Fan-out flow
// ------------
//   1. Parse and validate the `frequency` path param (daily | weekly).
//      Anything else → 400 (this is a fixed taxonomy, not user input).
//
//   2. SELECT every `NotificationPreference` row in the org's table
//      where `frequency = <param>` and `type = LOW_STOCK_DIGEST`,
//      joined to the User (for the recipient email + display name) and
//      to the Membership (to verify the user still belongs to the org).
//
//      Users whose membership was removed after opting in are silently
//      skipped — we don't delete NotificationPreference on Membership
//      delete (the prefs belong to the user, not the membership) so
//      the skip is a live runtime check.
//
//   3. Group rows by organizationId so each org computes its low-stock
//      list exactly once per run, no matter how many recipients it has.
//
//   4. For each org:
//        * call `getLowStockItems(orgId)` once
//        * build the digest email (same subject/body for every
//          recipient in that org)
//        * for each recipient, call `mailer.send(...)`
//        * after all recipients in the org are processed, emit a
//          single `notification.sent` audit event with
//          `{ cadence, type, recipients, delivered, failed, dryRun }`
//
// Idempotency
// -----------
// `lastDeliveredAt` on each preference row is updated after a
// successful `mailer.send`. If the cron is re-invoked within the same
// cadence window (e.g. a retry after a 5xx) we skip any row whose
// `lastDeliveredAt` is newer than `cadenceWindowStart(cadence, now)`.
//
// Failures during send are logged but do not abort the fan-out: one
// recipient's 4xx should not block the rest of the org. Failed rows do
// NOT get `lastDeliveredAt` updated — the next cadence window retries
// them automatically.
//
// Dry-run
// -------
// `?dryRun=true` short-circuits the mailer call and does not touch
// `lastDeliveredAt`, but still emits the audit event (tagged
// `dryRun: true`) and returns the would-be recipient list in the
// response. Useful for manual smoke tests via `curl` before wiring the
// scheduler.
//
// Observability
// -------------
// Every step logs through the structured logger so a failed fan-out
// can be traced back to the specific (org, user, error) tuple. The
// audit event is the durable signal — an auditor reading `/audit` sees
// a daily `notification.sent` row per active cadence per org.

import { NextResponse } from "next/server";

import { Role } from "@/generated/prisma";
import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { en } from "@/lib/i18n";
import { logger } from "@/lib/logger";
import { getMailer } from "@/lib/mail";
import { buildLowStockDigestEmail } from "@/lib/mail/templates/low-stock-digest-email";
import { getLowStockItems, groupBySupplier } from "@/lib/reports/low-stock";

// Force dynamic — the whole point is that each hit runs the fan-out.
// Without this, Next.js 15 would try to pre-render the route handler.
export const dynamic = "force-dynamic";
// Node runtime: Prisma + the Resend SDK both require Node APIs.
export const runtime = "nodejs";

type Cadence = "daily" | "weekly";

function isCadence(value: string): value is Cadence {
  return value === "daily" || value === "weekly";
}

/**
 * Compute the earliest `lastDeliveredAt` that should be treated as
 * "already delivered for this cadence window". Anything older is fair
 * game for a fresh delivery on this run.
 *
 * Daily window: 23 hours before `now`. A small margin below 24h lets
 * the scheduler drift slightly (e.g. cron fires at 09:00:01 on day N+1
 * when day N's hit was 09:00:00) without skipping a delivery.
 *
 * Weekly window: 6 days 23 hours before `now`. Same margin rationale.
 */
function cadenceWindowStart(cadence: Cadence, now: Date): Date {
  const ms =
    cadence === "daily"
      ? 23 * 60 * 60 * 1000 // 23h
      : (7 * 24 - 1) * 60 * 60 * 1000; // 6d 23h
  return new Date(now.getTime() - ms);
}

type ProcessOrgResult = {
  organizationId: string;
  organizationName: string;
  totalItems: number;
  recipientsAttempted: number;
  delivered: number;
  failed: number;
  skippedAsRecent: number;
};

type FanOutSummary = {
  cadence: Cadence;
  dryRun: boolean;
  organizationsProcessed: number;
  results: ProcessOrgResult[];
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ frequency: string }> },
): Promise<NextResponse> {
  // --- 1. Auth: CRON_SECRET must be set, and the bearer must match. --
  if (!env.CRON_SECRET) {
    logger.error("cron/notifications: CRON_SECRET is not configured", {});
    return NextResponse.json({ ok: false, error: "cron_secret_not_configured" }, { status: 503 });
  }
  const authHeader = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${env.CRON_SECRET}`;
  if (authHeader !== expected) {
    // Deliberately vague message — we don't want to confirm to an
    // attacker whether the header was missing or just wrong.
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // --- 2. Parse cadence param ----------------------------------------
  const { frequency } = await params;
  if (!isCadence(frequency)) {
    return NextResponse.json(
      { ok: false, error: "invalid_frequency", message: "Frequency must be 'daily' or 'weekly'." },
      { status: 400 },
    );
  }
  const cadence: Cadence = frequency;

  // --- 3. Dry-run flag -----------------------------------------------
  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "true";

  const now = new Date();
  const windowStart = cadenceWindowStart(cadence, now);

  // --- 4. Fetch opted-in preferences for this cadence ----------------
  // `frequency` maps 1:1 onto the pref row's frequency field. Type is
  // hard-coded to LOW_STOCK_DIGEST: Sprint 41 ships only the one type.
  // Follow-up sprints can loop over types here.
  const prefs = await db.notificationPreference.findMany({
    where: {
      type: "LOW_STOCK_DIGEST",
      frequency: cadence === "daily" ? "DAILY" : "WEEKLY",
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      organization: { select: { id: true, name: true } },
    },
  });

  // --- 5. Verify each recipient still has an active membership ------
  // NotificationPreference rows survive membership delete; we filter
  // them at fan-out time so an ex-member doesn't keep receiving
  // internal org data.
  const membershipKeys = new Set(
    (
      await db.membership.findMany({
        where: {
          userId: { in: prefs.map((p) => p.userId) },
          organizationId: { in: prefs.map((p) => p.organizationId) },
          role: {
            in: [Role.OWNER, Role.ADMIN, Role.MANAGER, Role.MEMBER, Role.VIEWER],
          },
        },
        select: { userId: true, organizationId: true },
      })
    ).map((m) => `${m.userId}:${m.organizationId}`),
  );
  const activePrefs = prefs.filter((p) => membershipKeys.has(`${p.userId}:${p.organizationId}`));

  // --- 6. Group by org so each org queries its shortfall once -------
  const byOrg = new Map<string, typeof activePrefs>();
  for (const pref of activePrefs) {
    const bucket = byOrg.get(pref.organizationId) ?? [];
    bucket.push(pref);
    byOrg.set(pref.organizationId, bucket);
  }

  // --- 7. Fan out per-org -------------------------------------------
  const mailer = getMailer();
  const results: ProcessOrgResult[] = [];

  for (const [organizationId, orgPrefs] of byOrg) {
    const organizationName = orgPrefs[0]?.organization.name ?? organizationId;
    const items = await getLowStockItems(organizationId);
    const groups = groupBySupplier(items);

    // Build the report URL. NEXT_PUBLIC_APP_URL is optional at the
    // env layer; fall back to a relative path so the email still
    // deep-links into the report when opened by a logged-in user.
    const reportUrl = env.NEXT_PUBLIC_APP_URL
      ? `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/reports/low-stock`
      : "/reports/low-stock";

    const { subject, text, html } = buildLowStockDigestEmail({
      to: "", // per-recipient below
      organizationName,
      groups,
      totalItems: items.length,
      cadence,
      reportUrl,
      labels: en.emails.lowStockDigest,
    });

    let delivered = 0;
    let failed = 0;
    let skippedAsRecent = 0;

    for (const pref of orgPrefs) {
      if (pref.lastDeliveredAt && pref.lastDeliveredAt > windowStart) {
        // Already delivered for this cadence window (retry / overlap).
        skippedAsRecent += 1;
        continue;
      }
      const recipient = pref.user.email;
      if (!recipient) continue;

      if (dryRun) {
        // Dry-run: count as delivered for the summary, but do NOT
        // touch lastDeliveredAt and do NOT hit the mailer. This keeps
        // the next real invocation producing a full fan-out.
        delivered += 1;
        logger.info("cron/notifications: dry-run send", {
          organizationId,
          recipient,
          cadence,
          totalItems: items.length,
        });
        continue;
      }

      const result = await mailer.send({ to: recipient, subject, text, html });
      if (result.ok) {
        delivered += 1;
        // Update lastDeliveredAt on success. A crash between send and
        // this update causes at most a duplicate on the next cadence
        // window — preferable to a silent drop.
        await db.notificationPreference.update({
          where: { id: pref.id },
          data: { lastDeliveredAt: now },
        });
      } else {
        failed += 1;
        logger.error("cron/notifications: mailer send failed", {
          organizationId,
          recipient,
          cadence,
          error: result.error,
        });
      }
    }

    // --- 8. Audit: one aggregate row per (org, cadence) -------------
    // Emitting per-user would flood the audit log with near-identical
    // rows on any org with more than a handful of recipients. The
    // aggregate row answers the compliance question ("did the daily
    // digest go out on 2026-04-11?") without being noisy.
    await recordAudit({
      organizationId,
      actorId: null,
      action: "notification.sent",
      entityType: "organization",
      entityId: organizationId,
      metadata: {
        cadence,
        type: "LOW_STOCK_DIGEST",
        recipientsAttempted: orgPrefs.length,
        delivered,
        failed,
        skippedAsRecent,
        totalItems: items.length,
        dryRun,
      },
    });

    results.push({
      organizationId,
      organizationName,
      totalItems: items.length,
      recipientsAttempted: orgPrefs.length,
      delivered,
      failed,
      skippedAsRecent,
    });
  }

  const summary: FanOutSummary = {
    cadence,
    dryRun,
    organizationsProcessed: results.length,
    results,
  };

  logger.info("cron/notifications: fan-out complete", {
    cadence,
    dryRun,
    organizations: results.length,
    delivered: results.reduce((a, r) => a + r.delivered, 0),
    failed: results.reduce((a, r) => a + r.failed, 0),
  });

  return NextResponse.json({ ok: true, ...summary });
}
