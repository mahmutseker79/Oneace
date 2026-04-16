"use server";

/**
 * Phase D — Scheduled Reports Server Actions
 *
 * CRUD operations for scheduled reports management:
 *   - createScheduledReport
 *   - updateScheduledReport
 *   - deleteScheduledReport
 *   - listScheduledReports
 */

import { z } from "zod";

import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { hasPlanCapability } from "@/lib/plans";
import { requireActiveMembership } from "@/lib/session";

export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

// Validation schemas
const CreateScheduledReportSchema = z.object({
  name: z.string().min(1).max(100),
  reportType: z.enum([
    "STOCK_VALUE",
    "LOW_STOCK",
    "COUNT_VARIANCE",
    "MOVEMENT_HISTORY",
    "ABC_ANALYSIS",
    "DEPARTMENT_VARIANCE",
    "COUNT_COMPARISON",
    "STOCK_AGING",
    "SUPPLIER_PERFORMANCE",
    "SCAN_ACTIVITY",
  ]),
  format: z.enum(["PDF", "XLSX", "CSV"]),
  cronExpression: z.string(), // e.g., "0 9 * * 1" for Monday 9am
  recipientEmails: z.array(z.string().email()).min(1),
  filters: z.record(z.any()).optional(),
});

const UpdateScheduledReportSchema = CreateScheduledReportSchema.partial().extend({
  id: z.string().cuid(),
  isActive: z.boolean().optional(),
});

/**
 * Create a new scheduled report
 */
export async function createScheduledReport(
  input: z.infer<typeof CreateScheduledReportSchema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const t = await getMessages();
    const { session: _session, membership } = await requireActiveMembership();

    // Check permissions
    if (!hasCapability(membership.role, "reports.schedule")) {
      return { ok: false, error: t.permissions.forbidden };
    }

    // Check plan capability
    const plan = membership.organization.plan as "FREE" | "PRO" | "BUSINESS";
    if (!hasPlanCapability(plan, "scheduledReports")) {
      return {
        ok: false,
        error: "Scheduled reports are available on the Business plan only.",
      };
    }

    // Validate input
    const validated = CreateScheduledReportSchema.parse(input);

    // Create the scheduled report
    const report = await db.scheduledReport.create({
      data: {
        organizationId: membership.organizationId,
        name: validated.name,
        reportType: validated.reportType,
        format: validated.format,
        cronExpression: validated.cronExpression,
        recipientEmails: validated.recipientEmails,
        filters: validated.filters || {},
        isActive: true,
        nextSendAt: new Date(), // Schedule first run immediately
      },
    });

    return { ok: true, data: { id: report.id } };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { ok: false, error: "Invalid input" };
    }
    console.error("Create scheduled report error:", error);
    return { ok: false, error: "Failed to create report" };
  }
}

/**
 * Update an existing scheduled report
 */
export async function updateScheduledReport(
  input: z.infer<typeof UpdateScheduledReportSchema>,
): Promise<ActionResult> {
  try {
    const t = await getMessages();
    const { membership } = await requireActiveMembership();

    // Check permissions
    if (!hasCapability(membership.role, "reports.schedule")) {
      return { ok: false, error: t.permissions.forbidden };
    }

    const validated = UpdateScheduledReportSchema.parse(input);

    // Verify ownership
    const existing = await db.scheduledReport.findUnique({
      where: { id: validated.id },
    });

    if (!existing || existing.organizationId !== membership.organizationId) {
      return { ok: false, error: "Report not found" };
    }

    // Update
    await db.scheduledReport.update({
      where: { id: validated.id },
      data: {
        ...(validated.name && { name: validated.name }),
        ...(validated.reportType && { reportType: validated.reportType }),
        ...(validated.format && { format: validated.format }),
        ...(validated.cronExpression && { cronExpression: validated.cronExpression }),
        ...(validated.recipientEmails && { recipientEmails: validated.recipientEmails }),
        ...(validated.filters && { filters: validated.filters }),
        ...(validated.isActive !== undefined && { isActive: validated.isActive }),
      },
    });

    return { ok: true } as ActionResult<void>;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { ok: false, error: "Invalid input" };
    }
    console.error("Update scheduled report error:", error);
    return { ok: false, error: "Failed to update report" };
  }
}

/**
 * Delete a scheduled report
 */
export async function deleteScheduledReport(reportId: string): Promise<ActionResult> {
  try {
    const t = await getMessages();
    const { membership } = await requireActiveMembership();

    // Check permissions
    if (!hasCapability(membership.role, "reports.schedule")) {
      return { ok: false, error: t.permissions.forbidden };
    }

    // Verify ownership
    const report = await db.scheduledReport.findUnique({
      where: { id: reportId },
    });

    if (!report || report.organizationId !== membership.organizationId) {
      return { ok: false, error: "Report not found" };
    }

    // Delete
    await db.scheduledReport.delete({ where: { id: reportId } });

    return { ok: true } as ActionResult<void>;
  } catch (error) {
    console.error("Delete scheduled report error:", error);
    return { ok: false, error: "Failed to delete report" };
  }
}

/**
 * List all scheduled reports for the organization
 */
export async function listScheduledReports(): Promise<
  ActionResult<
    Array<{
      id: string;
      name: string;
      reportType: string;
      format: string;
      cronExpression: string;
      recipientEmails: string[];
      isActive: boolean;
      lastSentAt: Date | null;
      nextSendAt: Date | null;
      createdAt: Date;
    }>
  >
> {
  try {
    const { membership } = await requireActiveMembership();

    const reports = await db.scheduledReport.findMany({
      where: { organizationId: membership.organizationId },
      orderBy: { createdAt: "desc" },
    });

    return {
      ok: true,
      data: reports.map((r) => ({
        id: r.id,
        name: r.name,
        reportType: r.reportType,
        format: r.format,
        cronExpression: r.cronExpression,
        recipientEmails: r.recipientEmails,
        isActive: r.isActive,
        lastSentAt: r.lastSentAt,
        nextSendAt: r.nextSendAt,
        createdAt: r.createdAt,
      })),
    };
  } catch (error) {
    console.error("List scheduled reports error:", error);
    return { ok: false, error: "Failed to fetch reports" };
  }
}
