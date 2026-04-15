/**
 * Sprint 33: outbound email abstraction.
 *
 * We deliberately keep this layer minimal:
 *   - A `Mailer` interface with a single `send(message)` method
 *   - Two implementations: `ConsoleMailer` (dev / tests) and
 *     `ResendMailer` (production)
 *   - A `getMailer()` factory in `./index.ts` that picks between
 *     them based on `RESEND_API_KEY` presence
 *
 * Why an interface instead of calling Resend directly from
 * `inviteMemberAction`:
 *
 *   1. Unit/integration tests never reach the network. Swapping in
 *      `ConsoleMailer` (or a stub that records calls) keeps test
 *      runs deterministic and fast.
 *   2. Local dev doesn't need a Resend API key to work — the admin
 *      still sees the copyable invite link in the UI, so missing
 *      email delivery is a soft failure.
 *   3. If we ever outgrow Resend (provider bill, deliverability,
 *      regional compliance), swapping in a Postmark or SES impl is
 *      a one-file change.
 *
 * Why a single `send(message)` method instead of a template-typed
 * API like `sendInvitationEmail(params)`:
 *
 *   Each template is built by a dedicated helper in
 *   `./templates/…` that returns a plain `{subject, text, html}`.
 *   The mailer stays ignorant of what kind of email it's sending;
 *   the templates stay ignorant of which provider is delivering.
 *   Separation of concerns: easy to render emails in Storybook, in
 *   tests, or in a future admin preview tool without spinning up
 *   any mailer at all.
 *
 * Result shape is a discriminated union so callers can log the
 * provider error text and still decide whether to surface the
 * failure to the end user or treat it as a soft miss.
 */

export type MailMessage = {
  /** RFC-5322 address — single recipient for now. */
  to: string;
  /** Subject line (no length limit enforced here; providers cap it). */
  subject: string;
  /** Plain-text body. Required — screen readers, plain-text clients. */
  text: string;
  /** HTML body. Required — this is the rendered path for most users. */
  html: string;
};

export type MailResult = { ok: true; id: string } | { ok: false; error: string };

/**
 * Minimal contract every provider implementation satisfies. Deliberately
 * does NOT expose the raw provider response — that would leak Resend
 * shape into callers and make swapping providers lossy.
 */
export interface Mailer {
  send(message: MailMessage): Promise<MailResult>;
}
