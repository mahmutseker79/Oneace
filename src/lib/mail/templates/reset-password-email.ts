/**
 * God-Mode v2 §1.2 — password reset email template.
 *
 * Renders the plain-text + HTML body for the password-reset link that
 * Better Auth sends from the `sendResetPassword` hook in `auth.ts`.
 *
 * Why a dedicated template (mirrors invitation-email.ts):
 *   - Consistent visual treatment across transactional email.
 *   - HTML escaping is centralized here — the caller only passes
 *     the recipient email and the already-constructed reset URL, and
 *     we sanitise both before embedding.
 *   - Lets us snapshot-test the output without booting a mailer.
 *
 * Design: neutral table-based layout, inline styles, single primary
 * call-to-action. Email clients in 2026 still treat flex/grid as
 * hostile; tables remain the lowest common denominator from Gmail to
 * Outlook.app to Apple Mail.
 */

export type ResetPasswordEmailParams = {
  /** Recipient address — used in the body copy only, not the routing. */
  to: string;
  /** Fully-qualified password-reset URL the user should click. */
  resetUrl: string;
  /**
   * Origin of the app, for the footer ("Sent from https://app.oneace…").
   * Usually `env.NEXT_PUBLIC_APP_URL` or a Vercel preview URL.
   */
  appOrigin: string;
  /**
   * How long the reset token remains valid (default 1 hour). We surface
   * this in the copy so the user understands why the link may already
   * have expired by the time they read it.
   */
  expiresInMinutes?: number;
};

export type ResetPasswordEmail = {
  subject: string;
  text: string;
  html: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildResetPasswordEmail(params: ResetPasswordEmailParams): ResetPasswordEmail {
  const expiresInMinutes = params.expiresInMinutes ?? 60;
  const safeUrl = escapeHtml(params.resetUrl);
  const safeOrigin = escapeHtml(params.appOrigin);
  const safeEmail = escapeHtml(params.to);

  const subject = "Reset your OneAce password";

  const text = [
    `Hi,`,
    ``,
    `We received a request to reset the password for the OneAce account registered to ${params.to}.`,
    ``,
    `Click the link below within ${expiresInMinutes} minutes to choose a new password:`,
    params.resetUrl,
    ``,
    `If you didn't request this, you can ignore this email — your password will stay the same.`,
    ``,
    `— OneAce`,
    params.appOrigin,
  ].join("\n");

  const html = `
<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
            <tr>
              <td style="padding:32px 32px 16px 32px;">
                <p style="margin:0 0 8px 0;font-size:14px;color:#64748b;">OneAce</p>
                <h1 style="margin:0 0 16px 0;font-size:22px;line-height:1.3;font-weight:600;">Reset your password</h1>
                <p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:#334155;">
                  We received a request to reset the password for the account registered to
                  <strong>${safeEmail}</strong>. Click the button below within
                  <strong>${expiresInMinutes} minutes</strong> to choose a new password.
                </p>
                <p style="margin:24px 0;">
                  <a href="${safeUrl}" style="display:inline-block;padding:12px 20px;background:#0f172a;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">Set a new password</a>
                </p>
                <p style="margin:0 0 16px 0;font-size:13px;line-height:1.6;color:#64748b;">
                  If the button doesn't work, copy and paste this URL into your browser:<br />
                  <a href="${safeUrl}" style="color:#0f172a;word-break:break-all;">${safeUrl}</a>
                </p>
                <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">
                  If you didn't request a password reset, you can ignore this email — your password will stay the same.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px;border-top:1px solid #e2e8f0;background:#f8fafc;font-size:12px;color:#94a3b8;">
                Sent from <a href="${safeOrigin}" style="color:#64748b;">${safeOrigin}</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`.trim();

  return { subject, text, html };
}
