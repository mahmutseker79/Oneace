/**
 * Sprint 33: dev/test mailer that logs to stdout and pretends to
 * succeed.
 *
 * Used whenever `RESEND_API_KEY` is unset, which covers:
 *   - Local `next dev` on a fresh clone (no secrets committed)
 *   - `next build` during CI
 *   - Unit / integration tests where we don't want network I/O
 *
 * The log line intentionally avoids dumping the full HTML body — that
 * would spam the terminal. Callers who need to inspect the rendered
 * HTML can import the template builder directly.
 */

import type { MailMessage, MailResult, Mailer } from "./mailer";

export class ConsoleMailer implements Mailer {
  async send(message: MailMessage): Promise<MailResult> {
     
    console.info(
      `[mail] would deliver "${message.subject}" to ${message.to} ` +
        `(html=${message.html.length}b, text=${message.text.length}b)`,
    );
    // Echo the plain-text body so a dev copying the invite link out of
    // the terminal has something to work with even when Resend is off.
     
    console.info(`[mail] text body:\n${message.text}`);
    return { ok: true, id: `console-${Date.now()}` };
  }
}
