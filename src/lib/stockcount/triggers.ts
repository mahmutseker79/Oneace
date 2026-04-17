/**
 * Phase B5.1 — Stock Count Triggering
 *
 * Decides when a new stock count should be automatically created from a
 * recurring `CountTemplate`. Used by a scheduled worker / cron endpoint
 * that runs every 15 minutes and by the manual "Run template now" button.
 *
 * This module is **pure** whenever possible: the cron evaluator, trigger
 * decision, and next-run calculator are all deterministic and take their
 * clock as an argument so they can be unit tested.
 *
 * Database-touching functions (`findDueTemplates`, `recordTemplateRun`)
 * are kept minimal and separate from the decision logic.
 */

import { db } from "@/lib/db";
import { resolveScopeItems } from "@/lib/stockcount/scope-resolver";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TriggerableTemplate {
  id: string;
  organizationId: string;
  name: string;
  isRecurring: boolean;
  cronExpression: string | null;
  nextScheduledAt: Date | null;
  lastUsedAt: Date | null;
}

export interface TriggerDecision {
  shouldTrigger: boolean;
  reason: string;
  nextRunAt: Date | null;
}

// ---------------------------------------------------------------------------
// Cron parsing — minimal 5-field subset (minute hour dom month dow).
//
// We support only these patterns, which cover the UI's "Daily 9am",
// "Weekly Monday 9am", "Monthly 1st 9am" presets:
//
//   "* * * * *"            — every minute (test only; denied in prod)
//   "0 * * * *"            — every hour
//   "M H * * *"            — daily at H:M
//   "M H * * D"            — weekly on day D at H:M
//   "M H D * *"            — monthly on day-of-month D at H:M
//
// Arbitrary cron strings (e.g. "*/5 1,13 * * 1-5") are rejected and cause
// `parseCron` to return null → the caller MUST treat an unparseable cron
// as non-triggering (never silently "never fire").
// ---------------------------------------------------------------------------

interface ParsedCron {
  minute: number;
  hour: number;
  dom: number | null; // day-of-month; null = wildcard
  dow: number | null; // day-of-week (0=Sunday); null = wildcard
}

export function parseCron(expr: string): ParsedCron | null {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return null;

  const [minStr, hourStr, domStr, monthStr, dowStr] = parts;
  // month wildcard is required — we don't support month selection
  if (monthStr !== "*") return null;

  const minute = toNumber(minStr);
  const hour = toNumber(hourStr);
  if (minute === null || hour === null) return null;
  if (minute < 0 || minute > 59 || hour < 0 || hour > 23) return null;

  // Non-wildcard fields must be valid numbers — reject ranges, lists, steps.
  let dom: number | null = null;
  if (domStr !== "*") {
    dom = toNumber(domStr);
    if (dom === null || dom < 1 || dom > 31) return null;
  }
  let dow: number | null = null;
  if (dowStr !== "*") {
    dow = toNumber(dowStr);
    if (dow === null || dow < 0 || dow > 6) return null;
  }

  // Reject both-specified (our UI never builds these)
  if (dom !== null && dow !== null) return null;

  return { minute, hour, dom, dow };
}

function toNumber(s: string | undefined): number | null {
  if (s === undefined) return null;
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------
// Next-run calculation
// ---------------------------------------------------------------------------

/**
 * Calculate the next firing time strictly AFTER `from`.
 * Returns null when the cron expression is invalid or malformed.
 *
 * The algorithm is deliberately simple: advance minute-by-minute up to a
 * one-year ceiling, testing the cron predicate. This is cheap because
 * we only ever call it a handful of times per template per day.
 */
export function calculateNextRun(cronExpression: string, from: Date): Date | null {
  const cron = parseCron(cronExpression);
  if (!cron) return null;

  // Start at the minute AFTER `from` (cron is edge-triggered).
  const candidate = new Date(from);
  candidate.setSeconds(0, 0);
  candidate.setMinutes(candidate.getMinutes() + 1);

  const CEILING_MINUTES = 366 * 24 * 60;
  for (let i = 0; i < CEILING_MINUTES; i++) {
    if (matchesCron(cron, candidate)) return candidate;
    candidate.setMinutes(candidate.getMinutes() + 1);
  }
  return null;
}

function matchesCron(cron: ParsedCron, d: Date): boolean {
  if (d.getMinutes() !== cron.minute) return false;
  if (d.getHours() !== cron.hour) return false;
  if (cron.dom !== null && d.getDate() !== cron.dom) return false;
  if (cron.dow !== null && d.getDay() !== cron.dow) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Trigger decision — pure
// ---------------------------------------------------------------------------

/**
 * Decide whether a template should fire right now.
 *
 * A template triggers when:
 *   1. `isRecurring === true`
 *   2. `cronExpression` parses to a valid schedule
 *   3. `nextScheduledAt` is null (first run) OR `nextScheduledAt <= now`
 *   4. It has NOT already been run within the same cron window
 *      (guards against re-firing if the worker lags)
 *
 * The returned `nextRunAt` is the NEXT scheduled time after `now` and
 * should be persisted on the template so the next poller call sees it.
 */
export function evaluateTrigger(
  template: TriggerableTemplate,
  now: Date = new Date(),
): TriggerDecision {
  if (!template.isRecurring) {
    return { shouldTrigger: false, reason: "Template is not recurring", nextRunAt: null };
  }
  if (!template.cronExpression) {
    return {
      shouldTrigger: false,
      reason: "Template has no cron expression",
      nextRunAt: null,
    };
  }

  const parsed = parseCron(template.cronExpression);
  if (!parsed) {
    return {
      shouldTrigger: false,
      reason: `Unsupported cron expression: ${template.cronExpression}`,
      nextRunAt: null,
    };
  }

  const scheduledAt = template.nextScheduledAt;

  // First run or overdue — fire immediately, compute next window from now.
  if (scheduledAt === null || scheduledAt.getTime() <= now.getTime()) {
    // Lag guard: if lastUsedAt is within 1 minute of the scheduled window
    // we've already fired this window; wait for the next one.
    if (template.lastUsedAt && scheduledAt) {
      const sameWindow = Math.abs(template.lastUsedAt.getTime() - scheduledAt.getTime()) < 60_000;
      if (sameWindow) {
        const nextRunAt = calculateNextRun(template.cronExpression, now);
        return {
          shouldTrigger: false,
          reason: "Already fired within this window",
          nextRunAt,
        };
      }
    }

    const nextRunAt = calculateNextRun(template.cronExpression, now);
    return {
      shouldTrigger: true,
      reason: "Schedule matched",
      nextRunAt,
    };
  }

  return {
    shouldTrigger: false,
    reason: `Scheduled for ${scheduledAt.toISOString()}`,
    nextRunAt: scheduledAt,
  };
}

// ---------------------------------------------------------------------------
// Database helpers — thin wrappers, no business logic beyond the query.
// ---------------------------------------------------------------------------

/**
 * Load all recurring templates that are due or have never run.
 * Scoped to one organization to avoid cross-tenant leakage.
 */
export async function findDueTemplates(
  organizationId: string,
  now: Date = new Date(),
): Promise<TriggerableTemplate[]> {
  const rows = await db.countTemplate.findMany({
    where: {
      organizationId,
      isRecurring: true,
      OR: [{ nextScheduledAt: null }, { nextScheduledAt: { lte: now } }],
    },
    select: {
      id: true,
      organizationId: true,
      name: true,
      isRecurring: true,
      cronExpression: true,
      nextScheduledAt: true,
      lastUsedAt: true,
    },
  });
  return rows;
}

/**
 * Create a new `StockCount` from a template. Returns the new count id.
 *
 * Scope items are resolved by `resolveScopeItems` so the snapshot build
 * path downstream sees exactly the intended catalog slice.
 */
export async function triggerCountFromTemplate(templateId: string): Promise<string> {
  const template = await db.countTemplate.findUnique({
    where: { id: templateId },
    select: {
      id: true,
      organizationId: true,
      name: true,
      methodology: true,
      scope: true,
      warehouseId: true,
      departmentId: true,
      cronExpression: true,
    },
  });
  if (!template) throw new Error(`Template ${templateId} not found`);

  // Resolve scope items — returns empty when FULL (handled by snapshot job).
  // Note: resolveScopeItems uses `orgId` (not organizationId) and does not
  // take warehouseId (scope is org-wide or department-wide, not warehouse).
  await resolveScopeItems({
    orgId: template.organizationId,
    scope: template.scope as "FULL" | "PARTIAL" | "DEPARTMENT",
    departmentId: template.departmentId ?? undefined,
  });

  const name = `${template.name} — ${new Date().toISOString().slice(0, 10)}`;

  const count = await db.stockCount.create({
    data: {
      organizationId: template.organizationId,
      warehouseId: template.warehouseId,
      departmentId: template.departmentId,
      templateId: template.id,
      name,
      state: "OPEN",
      methodology: template.methodology,
      scope: template.scope,
    },
    select: { id: true },
  });

  // Advance the template's schedule.
  const now = new Date();
  const nextScheduledAt = template.cronExpression
    ? calculateNextRun(template.cronExpression, now)
    : null;

  await db.countTemplate.update({
    where: { id: template.id },
    data: {
      lastUsedAt: now,
      nextScheduledAt,
    },
  });

  return count.id;
}

/**
 * Run the full trigger pass for one organization.
 *
 * Intended to be called from a scheduled worker (cron endpoint) every
 * 15 minutes. Returns the list of count ids created so the worker can
 * fan out snapshot-building jobs.
 */
export async function runTriggerPass(
  organizationId: string,
  now: Date = new Date(),
): Promise<Array<{ templateId: string; countId: string | null; reason: string }>> {
  const templates = await findDueTemplates(organizationId, now);
  const results: Array<{ templateId: string; countId: string | null; reason: string }> = [];

  for (const template of templates) {
    const decision = evaluateTrigger(template, now);
    if (!decision.shouldTrigger) {
      results.push({ templateId: template.id, countId: null, reason: decision.reason });
      continue;
    }
    try {
      const countId = await triggerCountFromTemplate(template.id);
      results.push({ templateId: template.id, countId, reason: decision.reason });
    } catch (err) {
      results.push({
        templateId: template.id,
        countId: null,
        reason: err instanceof Error ? err.message : "unknown error",
      });
    }
  }

  return results;
}
