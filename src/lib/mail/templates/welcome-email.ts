/**
 * Phase 15.4 — Welcome / getting-started email template.
 *
 * Sent after a user creates an organization (completes onboarding).
 * Provides a concise next-steps guide to drive first-week activation.
 *
 * Trigger: onboarding/organization creation action
 * Recipients: the user who just created the org (the OWNER)
 *
 * Env required: RESEND_API_KEY + MAIL_FROM (same as invitation email)
 * Falls back to ConsoleMailer silently when not configured.
 */

type WelcomeEmailParams = {
  userName: string;
  orgName: string;
  appUrl: string;
};

export function buildWelcomeEmail(params: WelcomeEmailParams): {
  subject: string;
  text: string;
  html: string;
} {
  const { userName, orgName, appUrl } = params;

  const firstName = userName.split(" ")[0] ?? userName;

  const subject = `Welcome to OneAce, ${firstName}!`;

  const text = `
Hi ${firstName},

Welcome to OneAce! Your workspace "${orgName}" is ready.

Here's how to get started in 5 minutes:

1. Add your first item: ${appUrl}/items/new
2. Set up a warehouse location: ${appUrl}/warehouses/new
3. Record your first stock movement: ${appUrl}/movements/new
4. Try barcode scanning: ${appUrl}/scan

OneAce works fully offline. Everything you do syncs automatically when you reconnect.

View your dashboard: ${appUrl}/dashboard

Questions? Reply to this email — we read every one.

— The OneAce Team
`.trim();

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f8f9fa;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation"
               style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;border:1px solid #e5e7eb;">
          <!-- Header -->
          <tr>
            <td style="padding:32px 32px 24px;border-bottom:1px solid #e5e7eb;">
              <table cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="background:#6366f1;border-radius:8px;padding:10px 16px;">
                    <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.3px;">OneAce</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 8px;font-size:22px;font-weight:600;color:#1e293b;">
                Welcome, ${escapeHtml(firstName)}!
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">
                Your workspace <strong style="color:#1e293b;">${escapeHtml(orgName)}</strong> is ready.
                Here&rsquo;s how to get set up in 5 minutes.
              </p>

              <!-- Steps -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                ${buildStep("1", "Add your first item", "Create a SKU with name, barcode, and cost price.", `${appUrl}/items/new`, "Add item &rarr;")}
                ${buildStep("2", "Set up a warehouse", "Create a location to track stock at the right place.", `${appUrl}/warehouses/new`, "Add location &rarr;")}
                ${buildStep("3", "Record your first movement", "Receive, adjust, or issue stock to your ledger.", `${appUrl}/movements/new`, "Record movement &rarr;")}
                ${buildStep("4", "Try barcode scanning", "Scan items with your camera or a wedge scanner.", `${appUrl}/scan`, "Open scanner &rarr;")}
              </table>

              <p style="margin:24px 0 0;font-size:13px;color:#94a3b8;line-height:1.5;">
                OneAce works fully offline. Every action syncs automatically when you reconnect.
              </p>
            </td>
          </tr>
          <!-- CTA -->
          <tr>
            <td style="padding:0 32px 32px;">
              <a href="${appUrl}/dashboard"
                 style="display:inline-block;background:#6366f1;color:#ffffff;font-size:15px;font-weight:600;
                        padding:12px 24px;border-radius:6px;text-decoration:none;">
                Open your dashboard &rarr;
              </a>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">
                You&rsquo;re receiving this because you just created a OneAce account.<br>
                Questions? Reply to this email — we read every one.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();

  return { subject, text, html };
}

// ---------------------------------------------------------------------------
// HTML helpers
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildStep(
  num: string,
  title: string,
  description: string,
  href: string,
  ctaText: string,
): string {
  return `
<tr>
  <td style="padding:0 0 16px;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="background:#f8fafc;border-radius:6px;border:1px solid #e5e7eb;">
      <tr>
        <td style="padding:16px;">
          <table cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td style="background:#6366f1;border-radius:50%;width:28px;height:28px;
                         text-align:center;vertical-align:middle;min-width:28px;">
                <span style="color:#ffffff;font-size:13px;font-weight:700;line-height:28px;">${num}</span>
              </td>
              <td style="padding-left:12px;">
                <p style="margin:0 0 2px;font-size:14px;font-weight:600;color:#1e293b;">${title}</p>
                <p style="margin:0;font-size:13px;color:#64748b;">${description}</p>
              </td>
              <td style="padding-left:16px;white-space:nowrap;">
                <a href="${escapeHtml(href)}"
                   style="font-size:13px;color:#6366f1;text-decoration:none;font-weight:500;">
                  ${ctaText}
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </td>
</tr>`;
}
