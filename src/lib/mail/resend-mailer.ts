/**
 * Sprint 33: production mailer backed by Resend's REST API.
 *
 * We deliberately do NOT pull in the official `resend` npm package:
 *
 *   - Bundle weight. Resend's SDK is small but it's a dependency we
 *     don't need — we speak one endpoint (POST /emails) and Node 20
 *     has `fetch` globally.
 *   - Supply-chain surface. Every dep we skip is one fewer audit
 *     target and one fewer `npm audit` notification.
 *   - Upgrade cadence. Pinning to the REST contract (which is
 *     versioned and documented) means an SDK minor bump can never
 *     silently change our behavior.
 *
 * Error classification: any non-2xx response is normalized to
 * `{ ok: false, error: "Resend HTTP <status>: <body>" }` so the
 * caller can log a single uniform shape. We also catch network
 * errors (fetch throws on DNS/TLS failures) and wrap them the same
 * way. The caller decides whether to surface the failure or swallow
 * it — this class never throws.
 *
 * Constructor takes the API key and `from` address explicitly so
 * tests can instantiate it without touching env vars. The factory
 * in `./index.ts` is the only place env vars are read.
 */

import type { MailMessage, MailResult, Mailer } from "./mailer";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export class ResendMailer implements Mailer {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: MailMessage): Promise<MailResult> {
    try {
      const res = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          html: message.html,
        }),
      });

      if (!res.ok) {
        // Best-effort body read for diagnostic logging. If Resend
        // returns malformed JSON we still want the status code.
        let bodyText = "";
        try {
          bodyText = await res.text();
        } catch {
          bodyText = "<unreadable body>";
        }
        return {
          ok: false,
          error: `Resend HTTP ${res.status}: ${bodyText.slice(0, 256)}`,
        };
      }

      const data = (await res.json().catch(() => ({}))) as { id?: string };
      return { ok: true, id: data.id ?? "" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown mailer error";
      return { ok: false, error: `Resend fetch failed: ${msg}` };
    }
  }
}
