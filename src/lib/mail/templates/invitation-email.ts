/**
 * Sprint 33: invitation email template.
 *
 * Renders both a plain-text and an HTML body given invitation
 * metadata. The template reads copy from `en.ts` — i18n'd per the
 * existing `getMessages()` pattern, though today we only have one
 * locale so the caller just passes through the default messages.
 *
 * Why a single file that returns both bodies:
 *
 *   - The subject + text + html are always produced together. A
 *     three-way split would just mean three imports for every
 *     caller.
 *   - HTML escaping is centralized here. The template builder is
 *     the only place that needs to know which user-controlled
 *     fields (organization name, inviter name) are untrusted.
 *   - Preview / snapshot tests render by calling this function and
 *     asserting against the output, without involving a mailer.
 *
 * HTML: self-contained, table-based layout. Email clients still
 * treat `<div>`-with-flexbox as hostile in 2026; tables render
 * consistently from Gmail to Outlook.app to Apple Mail. We use
 * inline styles for the same reason — no stylesheet support in
 * most clients.
 *
 * Brand: single primary color (slate-900 / near-black) for the
 * button because we don't yet have a brand palette shipped, and
 * a neutral button is harmless. Sprint 34+ can wire in brand
 * tokens via the theme-factory skill if we decide to.
 */

import type { Role } from "@/generated/prisma";

export type InvitationEmailParams = {
  /** Who the email is addressed to. */
  to: string;
  /** The organization they're being invited to join. */
  organizationName: string;
  /** Display name of the admin who sent the invite (or their email). */
  inviterName: string;
  /** The role they'll get. Used for label lookup, not gating. */
  role: Role;
  /** Absolute URL: `{base}/invite/{token}`. Never mutated here. */
  inviteUrl: string;
  /** When the invitation link stops working. */
  expiresAt: Date;
  /** Pre-resolved i18n bundle. See `InvitationEmailLabels` below. */
  labels: InvitationEmailLabels;
  /** `Intl.DateTimeFormat` matching the recipient's inferred region. */
  dateFmt: Intl.DateTimeFormat;
};

/**
 * i18n slice the template needs. The subject supports `{org}`,
 * `{inviter}`, and `{role}` placeholders; the body supports those
 * plus `{expires}` and `{url}`. Placeholders are substituted here,
 * not in the caller.
 */
export type InvitationEmailLabels = {
  subject: string;
  preheader: string;
  heading: string;
  bodyIntro: string;
  orgLabel: string;
  inviterLabel: string;
  roleLabel: string;
  cta: string;
  expiryNotice: string;
  fallbackLabel: string;
  footer: string;
};

export type RenderedInvitationEmail = {
  subject: string;
  text: string;
  html: string;
};

/**
 * HTML-escape a user-controlled string. Covers the five entities that
 * matter for attribute + text-node contexts in well-formed HTML. We
 * do not try to handle arbitrary contexts because the template only
 * inserts into text nodes + `href` attributes + the button label.
 */
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function applyPlaceholders(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (out, [key, val]) => out.replaceAll(`{${key}}`, val),
    template,
  );
}

/**
 * Build the fully rendered invitation email (subject + text + html).
 *
 * The caller is responsible for passing a role label that matches the
 * `labels.roleLabel` lookup in the i18n bundle — this template
 * receives pre-resolved strings, not enums, to keep it locale-agnostic.
 */
export function buildInvitationEmail(
  params: InvitationEmailParams & { roleLabel: string },
): RenderedInvitationEmail {
  const { organizationName, inviterName, inviteUrl, expiresAt, labels, dateFmt, roleLabel } =
    params;

  const expiresStr = dateFmt.format(expiresAt);

  const placeholderValues = {
    org: organizationName,
    inviter: inviterName,
    role: roleLabel,
    expires: expiresStr,
    url: inviteUrl,
  };

  const subject = applyPlaceholders(labels.subject, placeholderValues);

  // Plain-text body: no escaping, no layout. Keep it short — readers
  // who prefer plain text appreciate brevity. Include the URL in full
  // so Gmail / Outlook auto-link it.
  const text = [
    applyPlaceholders(labels.heading, placeholderValues),
    "",
    applyPlaceholders(labels.bodyIntro, placeholderValues),
    "",
    `${labels.orgLabel}: ${organizationName}`,
    `${labels.inviterLabel}: ${inviterName}`,
    `${labels.roleLabel}: ${roleLabel}`,
    "",
    inviteUrl,
    "",
    applyPlaceholders(labels.expiryNotice, placeholderValues),
    "",
    labels.footer,
  ].join("\n");

  // HTML body: table-based layout, inline styles.
  const safeOrg = escapeHtml(organizationName);
  const safeInviter = escapeHtml(inviterName);
  const safeRole = escapeHtml(roleLabel);
  const safeUrl = escapeHtml(inviteUrl);
  const safeHeading = escapeHtml(applyPlaceholders(labels.heading, placeholderValues));
  const safeBody = escapeHtml(applyPlaceholders(labels.bodyIntro, placeholderValues));
  const safeExpiry = escapeHtml(applyPlaceholders(labels.expiryNotice, placeholderValues));
  const safePreheader = escapeHtml(applyPlaceholders(labels.preheader, placeholderValues));
  const safeFooter = escapeHtml(labels.footer);
  const safeCta = escapeHtml(labels.cta);
  const safeOrgLabel = escapeHtml(labels.orgLabel);
  const safeInviterLabel = escapeHtml(labels.inviterLabel);
  const safeRoleLabel = escapeHtml(labels.roleLabel);
  const safeFallbackLabel = escapeHtml(labels.fallbackLabel);

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeHeading}</title>
  </head>
  <body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;color:transparent;">${safePreheader}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;padding:32px;max-width:560px;">
            <tr>
              <td style="font-size:20px;font-weight:600;color:#0f172a;padding-bottom:16px;">${safeHeading}</td>
            </tr>
            <tr>
              <td style="font-size:14px;line-height:1.6;color:#334155;padding-bottom:24px;">${safeBody}</td>
            </tr>
            <tr>
              <td style="padding-bottom:24px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;">
                  <tr>
                    <td style="padding:12px 16px;font-size:13px;color:#475569;">
                      <strong style="color:#0f172a;">${safeOrgLabel}:</strong> ${safeOrg}<br />
                      <strong style="color:#0f172a;">${safeInviterLabel}:</strong> ${safeInviter}<br />
                      <strong style="color:#0f172a;">${safeRoleLabel}:</strong> ${safeRole}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-bottom:24px;">
                <a href="${safeUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:6px;">${safeCta}</a>
              </td>
            </tr>
            <tr>
              <td style="font-size:12px;color:#64748b;padding-bottom:12px;">${safeExpiry}</td>
            </tr>
            <tr>
              <td style="font-size:12px;color:#64748b;padding-bottom:4px;">${safeFallbackLabel}</td>
            </tr>
            <tr>
              <td style="font-size:12px;word-break:break-all;"><a href="${safeUrl}" style="color:#0f172a;">${safeUrl}</a></td>
            </tr>
            <tr>
              <td style="border-top:1px solid #e2e8f0;margin-top:24px;padding-top:16px;font-size:11px;color:#94a3b8;">${safeFooter}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}
