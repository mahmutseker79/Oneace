/**
 * Audit v1.1 §5.28 — deliverability guard mailer.
 *
 * This is a `Mailer` decorator that consults `User.emailStatus` on
 * the way to `send()`. If the recipient has been marked BOUNCED,
 * COMPLAINED, or UNSUBSCRIBED by the Resend webhook handler, we
 * short-circuit with `ok:false` instead of hitting the provider.
 *
 * Why a decorator instead of teaching `ResendMailer` about it:
 *
 *   1. `ConsoleMailer` gets the same protection for free — handy
 *      when dev is pointing at a shared staging database where some
 *      rows are already flagged.
 *   2. The mailer implementations stay focused on "how do I hand
 *      bytes to a provider"; suppression is a policy layer, not a
 *      provider detail.
 *   3. One place to add a unit test and one place to log skips.
 *
 * Fail-open on lookup failure: if the DB query throws, we let the
 * send proceed and log a warning. Rationale: a flaky `User` table
 * shouldn't silently swallow password-reset emails. A flaky
 * provider is recoverable; a missed password reset is a support
 * ticket.
 *
 * Unknown recipients (no User row) pass through. Invitation emails
 * are by design sent to people who don't have accounts yet; the
 * suppression list only matters for addresses we've already seen
 * hard-fail.
 */

import type { MailMessage, MailResult, Mailer } from "./mailer";

/**
 * Narrow structural types so this module only depends on the method
 * shapes it actually uses. Avoids pulling Prisma types into the
 * unit-test surface.
 */
type EmailStatusLookup = {
  user: {
    findUnique: (args: {
      where: { email: string };
      select: { emailStatus: true };
    }) => Promise<{ emailStatus: string } | null>;
  };
};

type MinimalLogger = {
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
};

/** Email statuses that should suppress outbound sends. */
const SUPPRESSED_STATUSES = new Set(["BOUNCED", "COMPLAINED", "UNSUBSCRIBED"]);

export class DeliverabilityGuardMailer implements Mailer {
  constructor(
    private readonly inner: Mailer,
    private readonly dbHandle: EmailStatusLookup,
    private readonly logger: MinimalLogger,
  ) {}

  async send(message: MailMessage): Promise<MailResult> {
    const to = message.to.trim().toLowerCase();

    let lookup: { emailStatus: string } | null = null;
    try {
      lookup = await this.dbHandle.user.findUnique({
        where: { email: to },
        select: { emailStatus: true },
      });
    } catch (err) {
      // Fail-open: log and fall through. Better a duplicate send
      // than a swallowed critical email because of a transient DB
      // blip.
      const msg = err instanceof Error ? err.message : "unknown error";
      this.logger.warn("DeliverabilityGuard: emailStatus lookup failed; allowing send", {
        to,
        err: msg,
      });
      return this.inner.send(message);
    }

    if (lookup && SUPPRESSED_STATUSES.has(lookup.emailStatus)) {
      this.logger.info("DeliverabilityGuard: send suppressed", {
        to,
        status: lookup.emailStatus,
        subject: message.subject,
      });
      return {
        ok: false,
        error: `suppressed: recipient emailStatus=${lookup.emailStatus}`,
      };
    }

    return this.inner.send(message);
  }
}

/** Exposed for tests that want to assert the canonical set. */
export const __SUPPRESSED_STATUSES_FOR_TESTS = SUPPRESSED_STATUSES;
