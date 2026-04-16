/**
 * Phase D — Report Scheduler Execution Logic
 *
 * Cron-based execution of scheduled reports:
 *   - Check next scheduled run times
 *   - Generate reports on schedule
 *   - Send via email to recipients
 *   - Update execution history
 *
 * This runs in a background job/cron context (e.g., Vercel Cron Functions).
 */

import { db } from "@/lib/db";

export interface ScheduledReportExecution {
  reportId: string;
  reportName: string;
  executedAt: Date;
  sentTo: string[];
  success: boolean;
  error?: string;
}

/**
 * Parse a cron expression and determine if it's time to run
 * Supports 5-field cron: minute hour day month dayOfWeek
 *
 * Examples:
 *   "0 9 * * *" = every day at 9:00
 *   "0 9 * * 1" = every Monday at 9:00
 *   "0 9 1 * *" = first day of month at 9:00
 */
function shouldRunNow(cronExpression: string, now: Date): boolean {
  try {
    const parts = cronExpression.split(" ");
    const minute = parts[0] ?? "*";
    const hour = parts[1] ?? "*";
    const day = parts[2] ?? "*";
    const month = parts[3] ?? "*";
    const dayOfWeek = parts[4] ?? "*";

    const currentMinute = now.getMinutes();
    const currentHour = now.getHours();
    const currentDay = now.getDate();
    const currentMonth = now.getMonth() + 1; // getMonth is 0-indexed
    const currentDayOfWeek = now.getDay();

    // Check each field
    const matchMinute = minute === "*" || Number.parseInt(minute) === currentMinute;
    const matchHour = hour === "*" || Number.parseInt(hour) === currentHour;
    const matchDay = day === "*" || Number.parseInt(day) === currentDay;
    const matchMonth = month === "*" || Number.parseInt(month) === currentMonth;
    const matchDayOfWeek = dayOfWeek === "*" || Number.parseInt(dayOfWeek) === currentDayOfWeek;

    return matchMinute && matchHour && matchDay && matchMonth && matchDayOfWeek;
  } catch (error) {
    console.error("Cron parse error:", error);
    return false;
  }
}

/**
 * Process all due scheduled reports
 * Called by Vercel Cron or similar background job
 */
export async function processScheduledReports(): Promise<ScheduledReportExecution[]> {
  const now = new Date();
  const executions: ScheduledReportExecution[] = [];

  try {
    // Find all active reports due to run
    const dueReports = await db.scheduledReport.findMany({
      where: {
        isActive: true,
        nextSendAt: { lte: now },
      },
      include: {
        organization: { select: { id: true, name: true } },
      },
    });

    for (const report of dueReports) {
      try {
        // Check if it's time to run based on cron expression
        if (!shouldRunNow(report.cronExpression as string, now)) {
          continue;
        }

        // Generate the report (simplified—actual implementation would call report generators)
        const reportContent = await generateReport(
          report.organization.id,
          report.reportType as string,
          report.filters as Record<string, any>,
          report.format as string,
        );

        // Send email to recipients (simplified)
        await sendReportEmail(
          report.recipientEmails,
          report.name,
          report.organization.name,
          reportContent,
          report.format as string,
        );

        // Update last sent time and calculate next run
        const nextSendAt = calculateNextRunTime(report.cronExpression as string, now);

        await db.scheduledReport.update({
          where: { id: report.id },
          data: {
            lastSentAt: now,
            nextSendAt,
          },
        });

        executions.push({
          reportId: report.id,
          reportName: report.name,
          executedAt: now,
          sentTo: report.recipientEmails,
          success: true,
        });
      } catch (error) {
        console.error(`Error executing report ${report.id}:`, error);
        executions.push({
          reportId: report.id,
          reportName: report.name,
          executedAt: now,
          sentTo: report.recipientEmails,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  } catch (error) {
    console.error("Process scheduled reports error:", error);
  }

  return executions;
}

/**
 * Generate a report based on type and filters
 * This is a placeholder; actual implementation would call specific report generators
 */
async function generateReport(
  orgId: string,
  reportType: string,
  filters: Record<string, any>,
  format: string,
): Promise<Buffer> {
  // Placeholder: in reality, this would:
  // 1. Fetch data based on report type and filters
  // 2. Generate PDF/XLSX/CSV output
  // 3. Return the file buffer

  // For now, return empty buffer
  return Buffer.from("Report generated");
}

/**
 * Send report via email
 * This is a placeholder; actual implementation would use SendGrid/AWS SES/etc
 */
async function sendReportEmail(
  recipientEmails: string[],
  reportName: string,
  orgName: string,
  fileBuffer: Buffer,
  format: string,
): Promise<void> {
  // Placeholder: in reality, this would send an email with the report attached
  console.log(`Would send ${reportName} to ${recipientEmails.join(", ")} (org: ${orgName})`);
}

/**
 * Calculate the next run time based on cron expression
 * Simplified version—real implementation would use cron library
 */
function calculateNextRunTime(cronExpression: string, now: Date): Date {
  // For now, add one day and return same time
  const next = new Date(now);
  next.setDate(next.getDate() + 1);
  return next;
}
