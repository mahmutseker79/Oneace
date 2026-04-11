/**
 * Sprint 41: low-stock digest email template.
 *
 * Renders a periodic (daily or weekly) summary of every item currently
 * at or below its reorder point, grouped by preferred supplier. Mirrors
 * the Sprint 33 invitation template in shape: subject + text + html
 * produced by a single function, HTML escaping centralised, locale copy
 * passed in as a resolved `labels` bag so the template stays
 * locale-agnostic.
 *
 * Why a digest instead of per-item emails:
 *
 *   - One email per low-stock item would be a mailbox carpet-bomb for
 *     any real warehouse. A warehouse with 30 items below reorder point
 *     after a weekend is common; 30 emails Monday morning is a
 *     guaranteed unsubscribe.
 *   - Grouping by supplier is the natural unit of follow-up action. A
 *     manager reading the digest thinks "I'll call Acme for those 4"
 *     and "I'll check Beta for those 2" — not "I'll call Acme once per
 *     email".
 *   - A single daily/weekly cadence also gives the prefs UI a clean
 *     contract: "frequency = DAILY means one email per day with
 *     whatever shortfall exists at send time".
 *
 * HTML: same table-based layout as Sprint 33, same `<div>` preheader
 * trick, same near-black button — reusing the proven shape keeps the
 * visual language consistent across the app's outbound mail. The
 * button links to the on-screen `/reports/low-stock` page so the
 * recipient can see the grouped UI and open the "Create PO" shortcut.
 *
 * Truncation: if there are more than `MAX_ITEMS_PER_EMAIL` items, we
 * show the top N (same sort as the report: most urgent first) and add
 * a "+ N more" footer row. The digest is a prompt to act, not a
 * spreadsheet — anyone with >50 low-stock items is better served by
 * clicking through to the report than by scrolling an email.
 */

import type { LowStockGroup, LowStockItem } from "@/lib/reports/low-stock";

export type LowStockDigestCadence = "daily" | "weekly";

export type LowStockDigestEmailParams = {
  /** Who the email is addressed to. */
  to: string;
  /** Name of the recipient's organization. Used in subject + body. */
  organizationName: string;
  /** Already-computed low-stock groups (see `groupBySupplier`). */
  groups: LowStockGroup[];
  /** Total item count (groups may be truncated for rendering). */
  totalItems: number;
  /** "daily" or "weekly" — shapes the subject + intro copy. */
  cadence: LowStockDigestCadence;
  /** Absolute URL to the on-screen report (CTA button target). */
  reportUrl: string;
  /** Pre-resolved i18n bundle. See `LowStockDigestEmailLabels` below. */
  labels: LowStockDigestEmailLabels;
};

/**
 * i18n slice the template needs. The `{org}`, `{count}`, and `{suppliers}`
 * placeholders are substituted in the template; the caller hands us the
 * raw strings.
 */
export type LowStockDigestEmailLabels = {
  /** Subject line. Supports `{org}` and `{count}`. */
  subjectDaily: string;
  /** Subject line. Supports `{org}` and `{count}`. */
  subjectWeekly: string;
  /** Preview pane text. Supports `{count}` and `{suppliers}`. */
  preheader: string;
  /** Heading at top of the email. Supports `{org}`. */
  headingDaily: string;
  /** Heading at top of the email. Supports `{org}`. */
  headingWeekly: string;
  /** Lead paragraph. Supports `{count}` and `{suppliers}`. */
  bodyIntro: string;
  /** Label for the group heading with a known supplier. Supports `{supplier}`. */
  supplierHeading: string;
  /** Label for the group with items lacking a preferred supplier. */
  noSupplierHeading: string;
  /** Column header: item name. */
  columnItem: string;
  /** Column header: SKU. */
  columnSku: string;
  /** Column header: on-hand. */
  columnOnHand: string;
  /** Column header: reorder point. */
  columnReorderPoint: string;
  /** Column header: shortfall. */
  columnShortfall: string;
  /** CTA button text. */
  cta: string;
  /** Truncation note. Supports `{count}`. */
  moreItemsNote: string;
  /** Footer copy. */
  footer: string;
  /** "View this report online" fallback line. */
  fallbackLabel: string;
  /** Text body empty-state line (shown when the digest renders 0 items). */
  emptyBody: string;
};

export type RenderedLowStockDigestEmail = {
  subject: string;
  text: string;
  html: string;
};

/**
 * Hard cap on rows rendered in the email. Above this we show a
 * "+ N more" note. Kept generous enough to cover a busy warehouse's
 * Monday-morning list, but tight enough that the email stays scannable
 * on mobile and doesn't trigger Gmail's "message clipped" inline fold.
 */
const MAX_ITEMS_PER_EMAIL = 50;

/** Covers the five HTML entities that matter in text-node + attr contexts. */
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
 * Build the fully rendered low-stock digest email (subject + text + html).
 *
 * The caller is responsible for having already resolved the org's low-
 * stock list via `getLowStockItems` + `groupBySupplier`. This function
 * is a pure render — no DB access, no network — which makes it easy to
 * unit-test and to preview from a script.
 */
export function buildLowStockDigestEmail(
  params: LowStockDigestEmailParams,
): RenderedLowStockDigestEmail {
  const { organizationName, groups, totalItems, cadence, reportUrl, labels } = params;

  // Count suppliers with a real (non-null) supplier for the body
  // copy. "3 items across 2 suppliers" is more informative than just
  // "3 items" when the reviewer is deciding whether to open the email.
  const supplierGroupCount = groups.filter((g) => g.supplier !== null).length;

  const placeholderValues = {
    org: organizationName,
    count: String(totalItems),
    suppliers: String(supplierGroupCount),
  };

  const subjectTemplate = cadence === "daily" ? labels.subjectDaily : labels.subjectWeekly;
  const headingTemplate = cadence === "daily" ? labels.headingDaily : labels.headingWeekly;
  const subject = applyPlaceholders(subjectTemplate, placeholderValues);
  const heading = applyPlaceholders(headingTemplate, placeholderValues);
  const intro = applyPlaceholders(labels.bodyIntro, placeholderValues);
  const preheader = applyPlaceholders(labels.preheader, placeholderValues);

  // Flatten groups into a "top N" slice for rendering. We keep the
  // grouping structure for the visual layout but enforce a global
  // MAX_ITEMS_PER_EMAIL cap: the email walks the groups in order and
  // stops rendering rows once it has shown MAX_ITEMS_PER_EMAIL items
  // total. Any remaining items surface via a single "+ N more" note.
  const rendered: { group: LowStockGroup; items: LowStockItem[] }[] = [];
  let remaining = MAX_ITEMS_PER_EMAIL;
  let renderedCount = 0;
  for (const group of groups) {
    if (remaining <= 0) break;
    const slice = group.items.slice(0, remaining);
    if (slice.length === 0) continue;
    rendered.push({ group, items: slice });
    remaining -= slice.length;
    renderedCount += slice.length;
  }
  const truncatedCount = Math.max(0, totalItems - renderedCount);

  // --- Plain-text body -------------------------------------------------
  // Newline-separated sections, no tables, no markup. Keep the URL in
  // full so Gmail / Outlook auto-link it. Empty-state lives here too —
  // a scheduler that mis-fires on an org with no shortfall will still
  // deliver a harmless "nothing to reorder right now" line instead of
  // a blank body.
  const textLines: string[] = [heading, "", intro, ""];
  if (totalItems === 0) {
    textLines.push(labels.emptyBody, "");
  } else {
    for (const { group, items } of rendered) {
      const groupHeading = group.supplier
        ? applyPlaceholders(labels.supplierHeading, { supplier: group.supplier.name })
        : labels.noSupplierHeading;
      textLines.push(groupHeading);
      for (const item of items) {
        const shortfall = item.reorderPoint - item.onHand;
        textLines.push(
          `  - ${item.name} (${item.sku}): ${labels.columnOnHand} ${item.onHand} / ${labels.columnReorderPoint} ${item.reorderPoint} · ${labels.columnShortfall} ${shortfall}`,
        );
      }
      textLines.push("");
    }
    if (truncatedCount > 0) {
      textLines.push(applyPlaceholders(labels.moreItemsNote, { count: String(truncatedCount) }));
      textLines.push("");
    }
  }
  textLines.push(reportUrl, "", labels.footer);
  const text = textLines.join("\n");

  // --- HTML body -------------------------------------------------------
  const safeHeading = escapeHtml(heading);
  const safeIntro = escapeHtml(intro);
  const safePreheader = escapeHtml(preheader);
  const safeUrl = escapeHtml(reportUrl);
  const safeCta = escapeHtml(labels.cta);
  const safeFooter = escapeHtml(labels.footer);
  const safeFallback = escapeHtml(labels.fallbackLabel);
  const safeColumnItem = escapeHtml(labels.columnItem);
  const safeColumnSku = escapeHtml(labels.columnSku);
  const safeColumnOnHand = escapeHtml(labels.columnOnHand);
  const safeColumnReorderPoint = escapeHtml(labels.columnReorderPoint);
  const safeColumnShortfall = escapeHtml(labels.columnShortfall);

  function renderGroupHtml(group: LowStockGroup, items: LowStockItem[]): string {
    const safeGroupHeading = group.supplier
      ? escapeHtml(applyPlaceholders(labels.supplierHeading, { supplier: group.supplier.name }))
      : escapeHtml(labels.noSupplierHeading);

    const rows = items
      .map((item) => {
        const shortfall = item.reorderPoint - item.onHand;
        const safeName = escapeHtml(item.name);
        const safeSku = escapeHtml(item.sku);
        return `<tr>
                      <td style="padding:8px 12px;font-size:13px;color:#0f172a;border-top:1px solid #e2e8f0;">${safeName}</td>
                      <td style="padding:8px 12px;font-size:12px;color:#64748b;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;border-top:1px solid #e2e8f0;">${safeSku}</td>
                      <td style="padding:8px 12px;font-size:13px;color:#0f172a;text-align:right;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;border-top:1px solid #e2e8f0;">${item.onHand}</td>
                      <td style="padding:8px 12px;font-size:13px;color:#64748b;text-align:right;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;border-top:1px solid #e2e8f0;">${item.reorderPoint}</td>
                      <td style="padding:8px 12px;font-size:13px;color:#b91c1c;text-align:right;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;border-top:1px solid #e2e8f0;">${shortfall}</td>
                    </tr>`;
      })
      .join("");

    return `<tr>
              <td style="padding-top:24px;padding-bottom:8px;font-size:14px;font-weight:600;color:#0f172a;">${safeGroupHeading}</td>
            </tr>
            <tr>
              <td>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:6px;border-collapse:separate;">
                  <tr>
                    <th style="padding:8px 12px;font-size:11px;color:#64748b;text-align:left;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;">${safeColumnItem}</th>
                    <th style="padding:8px 12px;font-size:11px;color:#64748b;text-align:left;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;">${safeColumnSku}</th>
                    <th style="padding:8px 12px;font-size:11px;color:#64748b;text-align:right;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;">${safeColumnOnHand}</th>
                    <th style="padding:8px 12px;font-size:11px;color:#64748b;text-align:right;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;">${safeColumnReorderPoint}</th>
                    <th style="padding:8px 12px;font-size:11px;color:#64748b;text-align:right;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;">${safeColumnShortfall}</th>
                  </tr>
                  ${rows}
                </table>
              </td>
            </tr>`;
  }

  const groupsHtml =
    totalItems === 0
      ? `<tr><td style="padding:16px 0;font-size:13px;color:#64748b;">${escapeHtml(labels.emptyBody)}</td></tr>`
      : rendered.map(({ group, items }) => renderGroupHtml(group, items)).join("");

  const truncationHtml =
    truncatedCount > 0
      ? `<tr>
              <td style="padding-top:16px;font-size:12px;color:#64748b;">${escapeHtml(
                applyPlaceholders(labels.moreItemsNote, { count: String(truncatedCount) }),
              )}</td>
            </tr>`
      : "";

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
          <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;padding:32px;max-width:640px;">
            <tr>
              <td style="font-size:20px;font-weight:600;color:#0f172a;padding-bottom:16px;">${safeHeading}</td>
            </tr>
            <tr>
              <td style="font-size:14px;line-height:1.6;color:#334155;padding-bottom:8px;">${safeIntro}</td>
            </tr>
            ${groupsHtml}
            ${truncationHtml}
            <tr>
              <td align="center" style="padding-top:28px;padding-bottom:16px;">
                <a href="${safeUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:6px;">${safeCta}</a>
              </td>
            </tr>
            <tr>
              <td style="font-size:12px;color:#64748b;padding-bottom:4px;">${safeFallback}</td>
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
