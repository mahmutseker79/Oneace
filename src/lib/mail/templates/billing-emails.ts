/**
 * Phase 16.7 — Billing lifecycle email templates.
 *
 * Sent by the webhook handler (fire-and-forget, soft-failure) at key billing moments:
 *   - Payment failed (payment failure notification)
 *   - Plan restored (payment recovery — plan restored after prior failure)
 *   - Plan upgraded (upgrade confirmation after checkout)
 *   - Plan downgraded / cancelled (moved to FREE after cancellation or failed payments)
 *   - Cancellation pending (cancel_at_period_end set — plan cancels at period end)
 *
 * All templates share the same HTML structure as the welcome email.
 * All use the `escapeHtml` helper to prevent XSS in user-provided strings.
 *
 * Trigger points:
 *   - billing.payment_failed     → handlePaymentFailed (does NOT downgrade immediately)
 *   - billing.payment_recovered  → handlePaymentSucceeded (plan restored)
 *   - billing.plan_upgraded       → handleCheckoutCompleted
 *   - billing.plan_downgraded    → handleSubscriptionUpdated (inactive status)
 *   - billing.subscription_cancelled → handleSubscriptionDeleted
 *   - billing.cancellation_pending   → handleSubscriptionUpdated (cancel_at_period_end)
 */

// ---------------------------------------------------------------------------
// HTML helper (identical to welcome-email.ts to avoid a shared import cycle)
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---------------------------------------------------------------------------
// Shared layout wrapper
// ---------------------------------------------------------------------------

function wrapHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
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
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">
                You&rsquo;re receiving this because you have a OneAce account.<br>
                Questions? Reply to this email — we read every one.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Payment failure email
// ---------------------------------------------------------------------------

type PaymentFailedParams = {
  userName: string;
  orgName: string;
  appUrl: string;
  amountDue: number; // in cents
  currency: string;
  attemptCount: number;
  nextAttemptDate: string | null; // human-readable date or null
};

export function buildPaymentFailedEmail(params: PaymentFailedParams): {
  subject: string;
  text: string;
  html: string;
} {
  const { userName, orgName, appUrl, amountDue, currency, attemptCount, nextAttemptDate } = params;
  const firstName = userName.split(" ")[0] ?? userName;
  const amountFormatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountDue / 100);

  const subject = `Action required: Payment failed for ${orgName}`;

  const text = `
Hi ${firstName},

We were unable to process your payment of ${amountFormatted} for ${orgName}.

This is attempt ${attemptCount}. ${nextAttemptDate ? `We will retry on ${nextAttemptDate}.` : "No further retries are scheduled."}

To keep your plan active, please update your payment method:
→ ${appUrl}/settings/billing

If payment is not received, your account will be moved to the Free plan.

Questions? Reply to this email — we read every one.

— The OneAce Team
`.trim();

  const html = wrapHtml(
    subject,
    `<p style="margin:0 0 8px;font-size:22px;font-weight:600;color:#1e293b;">
      Payment failed
    </p>
    <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">
      Hi ${escapeHtml(firstName)}, we were unable to charge <strong style="color:#1e293b;">${escapeHtml(amountFormatted)}</strong>
      for <strong style="color:#1e293b;">${escapeHtml(orgName)}</strong>.
    </p>
    <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:6px;padding:16px;margin-bottom:24px;">
      <p style="margin:0;font-size:14px;color:#92400e;line-height:1.5;">
        This is attempt <strong>${escapeHtml(String(attemptCount))}</strong>.
        ${nextAttemptDate ? `We will retry on <strong>${escapeHtml(nextAttemptDate)}</strong>.` : "No further retries are scheduled."}
        If payment is not received, your account will be moved to the Free plan.
      </p>
    </div>
    <a href="${escapeHtml(appUrl)}/settings/billing"
       style="display:inline-block;background:#6366f1;color:#ffffff;font-size:15px;font-weight:600;
              padding:12px 24px;border-radius:6px;text-decoration:none;">
      Update payment method &rarr;
    </a>`,
  );

  return { subject, text, html };
}

// ---------------------------------------------------------------------------
// Payment recovery email
// ---------------------------------------------------------------------------

type PaymentRecoveredParams = {
  userName: string;
  orgName: string;
  appUrl: string;
  restoredPlan: string;
  billingInterval: string;
};

export function buildPaymentRecoveredEmail(params: PaymentRecoveredParams): {
  subject: string;
  text: string;
  html: string;
} {
  const { userName, orgName, appUrl, restoredPlan, billingInterval } = params;
  const firstName = userName.split(" ")[0] ?? userName;
  const planLabel = restoredPlan === "PRO" ? "Pro" : "Business";
  const intervalLabel = billingInterval === "year" ? "annual" : "monthly";

  const subject = `Payment received — your ${planLabel} plan is active`;

  const text = `
Hi ${firstName},

Good news: your payment was received and your ${planLabel} (${intervalLabel}) plan for ${orgName} is now active again.

Your dashboard is ready:
→ ${appUrl}/dashboard

Questions? Reply to this email — we read every one.

— The OneAce Team
`.trim();

  const html = wrapHtml(
    subject,
    `<p style="margin:0 0 8px;font-size:22px;font-weight:600;color:#1e293b;">
      Your plan is active again
    </p>
    <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">
      Hi ${escapeHtml(firstName)}, your payment was received and your
      <strong style="color:#1e293b;">${escapeHtml(planLabel)}</strong> (${escapeHtml(intervalLabel)}) plan
      for <strong style="color:#1e293b;">${escapeHtml(orgName)}</strong> is now active.
    </p>
    <a href="${escapeHtml(appUrl)}/dashboard"
       style="display:inline-block;background:#6366f1;color:#ffffff;font-size:15px;font-weight:600;
              padding:12px 24px;border-radius:6px;text-decoration:none;">
      Open your dashboard &rarr;
    </a>`,
  );

  return { subject, text, html };
}

// ---------------------------------------------------------------------------
// Upgrade confirmation email
// ---------------------------------------------------------------------------

type UpgradeConfirmationParams = {
  userName: string;
  orgName: string;
  appUrl: string;
  newPlan: string;
  billingInterval: string;
};

export function buildUpgradeConfirmationEmail(params: UpgradeConfirmationParams): {
  subject: string;
  text: string;
  html: string;
} {
  const { userName, orgName, appUrl, newPlan, billingInterval } = params;
  const firstName = userName.split(" ")[0] ?? userName;
  const planLabel = newPlan === "PRO" ? "Pro" : "Business";
  const intervalLabel = billingInterval === "year" ? "annual" : "monthly";

  const subject = `Welcome to ${planLabel} — ${orgName} is upgraded`;

  const unlockedFeatures =
    newPlan === "PRO"
      ? [
          "Unlimited items and warehouse locations",
          "Bin-level inventory tracking and putaway",
          "Purchase orders with scan-assisted receiving",
          "CSV and Excel exports",
          "Reports (stock value, movements, bins)",
        ]
      : ["Everything in Pro", "Unlimited team members", "Full audit log with complete history"];

  const featureListText = unlockedFeatures.map((f) => `  • ${f}`).join("\n");
  const featureListHtml = unlockedFeatures
    .map(
      (f) =>
        `<tr><td style="padding:4px 0;font-size:14px;color:#1e293b;">✓ ${escapeHtml(f)}</td></tr>`,
    )
    .join("");

  const text = `
Hi ${firstName},

${orgName} is now on the ${planLabel} plan (${intervalLabel}). Here's what you've unlocked:

${featureListText}

Open your dashboard:
→ ${appUrl}/dashboard

Questions? Reply to this email — we read every one.

— The OneAce Team
`.trim();

  const html = wrapHtml(
    subject,
    `<p style="margin:0 0 8px;font-size:22px;font-weight:600;color:#1e293b;">
      You&rsquo;re on ${escapeHtml(planLabel)}
    </p>
    <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">
      Hi ${escapeHtml(firstName)}, <strong style="color:#1e293b;">${escapeHtml(orgName)}</strong> is now on the
      <strong style="color:#1e293b;">${escapeHtml(planLabel)}</strong> (${escapeHtml(intervalLabel)}) plan.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="background:#f8fafc;border-radius:6px;border:1px solid #e5e7eb;margin-bottom:24px;">
      <tr><td style="padding:16px;">
        <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#6366f1;text-transform:uppercase;letter-spacing:0.5px;">
          What&rsquo;s unlocked
        </p>
        <table cellpadding="0" cellspacing="0" role="presentation">
          ${featureListHtml}
        </table>
      </td></tr>
    </table>
    <a href="${escapeHtml(appUrl)}/dashboard"
       style="display:inline-block;background:#6366f1;color:#ffffff;font-size:15px;font-weight:600;
              padding:12px 24px;border-radius:6px;text-decoration:none;">
      Open your dashboard &rarr;
    </a>`,
  );

  return { subject, text, html };
}

// ---------------------------------------------------------------------------
// Plan downgrade / cancellation email
// ---------------------------------------------------------------------------

type PlanDowngradedParams = {
  userName: string;
  orgName: string;
  appUrl: string;
  previousPlan: string;
  reason: "payment_failure" | "cancellation";
};

export function buildPlanDowngradedEmail(params: PlanDowngradedParams): {
  subject: string;
  text: string;
  html: string;
} {
  const { userName, orgName, appUrl, previousPlan, reason } = params;
  const firstName = userName.split(" ")[0] ?? userName;
  const previousPlanLabel = previousPlan === "PRO" ? "Pro" : "Business";

  const subject =
    reason === "payment_failure"
      ? `Your ${previousPlanLabel} plan has been paused — action required`
      : `Your subscription has ended — ${orgName} is now on Free`;

  const reasonText =
    reason === "payment_failure"
      ? "because payment retries were exhausted"
      : "because your subscription ended";

  const text = `
Hi ${firstName},

${orgName} has been moved to the Free plan ${reasonText}.

You still have access to core features (up to 100 items, 1 location, 3 members). Premium features are no longer available.

To restore your ${previousPlanLabel} plan:
→ ${appUrl}/settings/billing

Questions? Reply to this email — we read every one.

— The OneAce Team
`.trim();

  const html = wrapHtml(
    subject,
    `<p style="margin:0 0 8px;font-size:22px;font-weight:600;color:#1e293b;">
      Your plan has changed
    </p>
    <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">
      Hi ${escapeHtml(firstName)}, <strong style="color:#1e293b;">${escapeHtml(orgName)}</strong> has been moved
      to the <strong style="color:#1e293b;">Free plan</strong> ${escapeHtml(reasonText)}.
    </p>
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:16px;margin-bottom:24px;">
      <p style="margin:0;font-size:14px;color:#991b1b;line-height:1.5;">
        Premium features (bins, purchase orders, exports, reports) are no longer available.
        Core features remain active: up to 100 items, 1 location, 3 team members.
      </p>
    </div>
    <a href="${escapeHtml(appUrl)}/settings/billing"
       style="display:inline-block;background:#6366f1;color:#ffffff;font-size:15px;font-weight:600;
              padding:12px 24px;border-radius:6px;text-decoration:none;">
      Restore ${escapeHtml(previousPlanLabel)} &rarr;
    </a>`,
  );

  return { subject, text, html };
}

// ---------------------------------------------------------------------------
// Cancellation pending email
// ---------------------------------------------------------------------------

type CancellationPendingParams = {
  userName: string;
  orgName: string;
  appUrl: string;
  currentPlan: string;
  cancelAt: string; // ISO string
};

export function buildCancellationPendingEmail(params: CancellationPendingParams): {
  subject: string;
  text: string;
  html: string;
} {
  const { userName, orgName, appUrl, currentPlan, cancelAt } = params;
  const firstName = userName.split(" ")[0] ?? userName;
  const planLabel = currentPlan === "PRO" ? "Pro" : "Business";
  const cancelDate = new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(
    new Date(cancelAt),
  );

  const subject = `Your ${planLabel} plan will end on ${cancelDate}`;

  const text = `
Hi ${firstName},

Your ${planLabel} plan for ${orgName} is set to cancel on ${cancelDate}. After that date, you will be moved to the Free plan.

If you change your mind, you can reactivate your subscription at any time before the cancellation date:
→ ${appUrl}/settings/billing

Questions? Reply to this email — we read every one.

— The OneAce Team
`.trim();

  const html = wrapHtml(
    subject,
    `<p style="margin:0 0 8px;font-size:22px;font-weight:600;color:#1e293b;">
      Your plan is set to cancel
    </p>
    <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">
      Hi ${escapeHtml(firstName)}, your <strong style="color:#1e293b;">${escapeHtml(planLabel)}</strong> plan
      for <strong style="color:#1e293b;">${escapeHtml(orgName)}</strong> will end on
      <strong style="color:#1e293b;">${escapeHtml(cancelDate)}</strong>.
      After that date, you will be moved to the Free plan.
    </p>
    <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">
      You can reactivate your subscription at any time before the cancellation date.
    </p>
    <a href="${escapeHtml(appUrl)}/settings/billing"
       style="display:inline-block;background:#6366f1;color:#ffffff;font-size:15px;font-weight:600;
              padding:12px 24px;border-radius:6px;text-decoration:none;">
      Manage subscription &rarr;
    </a>`,
  );

  return { subject, text, html };
}
