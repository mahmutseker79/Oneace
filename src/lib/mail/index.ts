/**
 * Sprint 33: mailer factory.
 *
 * `getMailer()` is the only place that reads mail-related env vars.
 * Every caller goes through this function so that:
 *
 *   1. Tests can monkey-patch by setting/clearing `RESEND_API_KEY`
 *      in `process.env` before import.
 *   2. Swapping providers touches one module.
 *   3. The cached instance is memoized per-process, so we don't
 *      construct a new class on every action invocation (cheap
 *      today but free to keep it that way).
 *
 * Env contract:
 *
 *   RESEND_API_KEY  (required for prod delivery; absent → ConsoleMailer)
 *   MAIL_FROM       (required whenever RESEND_API_KEY is set; must be
 *                    a verified Resend sender or the API will 403)
 *
 * Sprint 37 update: the env-schema module now enforces the "both
 * set or both unset" invariant at boot time, so this factory only
 * has to deal with the two legal states. We still read through the
 * validated `env` object so tests that monkey-patch `process.env`
 * and call `resetMailerForTests()` keep working via the re-export
 * (the env module is evaluated once, so mutating `process.env`
 * after import is a no-op — historical notes in tests).
 *
 * Audit v1.1 §5.28 update: the cached mailer is wrapped in a
 * `DeliverabilityGuardMailer` that short-circuits `send()` for
 * recipients whose `User.emailStatus` is not ACTIVE. This protects
 * our sending-domain reputation — continuing to send to bounced /
 * complained / unsubscribed addresses is what gets us throttled
 * by Resend. Unknown recipients (no User row) fall through to the
 * underlying mailer, because invite emails are by definition sent
 * to people who don't have accounts yet.
 */

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { ConsoleMailer } from "./console-mailer";
import { DeliverabilityGuardMailer } from "./deliverability-guard";
import type { Mailer } from "./mailer";
import { ResendMailer } from "./resend-mailer";

let cached: Mailer | null = null;

/**
 * Return the process-wide mailer. Subsequent calls return the same
 * instance. Use `resetMailerForTests()` in tests that need to swap
 * implementations mid-run.
 */
export function getMailer(): Mailer {
  if (cached) return cached;

  const apiKey = env.RESEND_API_KEY;
  const from = env.MAIL_FROM;

  const inner: Mailer =
    !apiKey || !from ? new ConsoleMailer() : new ResendMailer(apiKey, from);

  // §5.28 — wrap with the deliverability guard so every call site
  // picks up suppression for free.
  cached = new DeliverabilityGuardMailer(inner, db, logger);
  return cached;
}

/**
 * Drop the cached instance so the next `getMailer()` call rebuilds
 * from env. Used by tests that mutate `process.env`. Not exported
 * from the barrel for app code — import explicitly if you need it.
 */
export function resetMailerForTests(): void {
  cached = null;
}

export type { Mailer, MailMessage, MailResult } from "./mailer";
