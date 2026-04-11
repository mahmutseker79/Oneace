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
 * We intentionally do NOT crash at boot if `RESEND_API_KEY` is set
 * but `MAIL_FROM` is missing — a clearer error is "mail delivery
 * failed: no from address" at send time than a cryptic startup
 * stack trace in a serverless function.
 */

import { ConsoleMailer } from "./console-mailer";
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

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;

  if (!apiKey || !from) {
    cached = new ConsoleMailer();
    return cached;
  }

  cached = new ResendMailer(apiKey, from);
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
