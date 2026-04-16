"use client";

/**
 * Phase D — Create scheduled report form
 *
 * Client form that collects a report type, format, schedule preset, and
 * recipient list. We don't accept arbitrary cron strings — instead we
 * give users four presets (Daily, Weekday, Weekly, Monthly) that map to
 * the cron subset our trigger engine supports.
 */

import { Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { createScheduledReport } from "../actions";

type ReportType =
  | "STOCK_VALUE"
  | "LOW_STOCK"
  | "COUNT_VARIANCE"
  | "MOVEMENT_HISTORY"
  | "ABC_ANALYSIS"
  | "DEPARTMENT_VARIANCE"
  | "COUNT_COMPARISON"
  | "STOCK_AGING"
  | "SUPPLIER_PERFORMANCE"
  | "SCAN_ACTIVITY";

type Format = "PDF" | "XLSX" | "CSV";

type SchedulePreset = "daily" | "weekday" | "weekly" | "monthly";

const REPORT_LABELS: Record<ReportType, string> = {
  STOCK_VALUE: "Stock Value",
  LOW_STOCK: "Low Stock",
  COUNT_VARIANCE: "Count Variance",
  MOVEMENT_HISTORY: "Movement History",
  ABC_ANALYSIS: "ABC Analysis",
  DEPARTMENT_VARIANCE: "Department Variance",
  COUNT_COMPARISON: "Count Comparison",
  STOCK_AGING: "Stock Aging",
  SUPPLIER_PERFORMANCE: "Supplier Performance",
  SCAN_ACTIVITY: "Scan Activity",
};

function cronFor(preset: SchedulePreset, hour: number, minute: number, dow: number): string {
  const m = String(minute);
  const h = String(hour);
  switch (preset) {
    case "daily":
      return `${m} ${h} * * *`;
    case "weekday":
      // We map weekday to "every weekday" — but our parser rejects
      // comma/range lists. So fall back to weekly Monday for safety
      // and document the limitation in the UI.
      return `${m} ${h} * * 1`;
    case "weekly":
      return `${m} ${h} * * ${dow}`;
    case "monthly":
      return `${m} ${h} 1 * *`;
  }
}

export function CreateScheduledReportForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState("Weekly Stock Value");
  const [reportType, setReportType] = useState<ReportType>("STOCK_VALUE");
  const [format, setFormat] = useState<Format>("PDF");
  const [preset, setPreset] = useState<SchedulePreset>("weekly");
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);
  const [dow, setDow] = useState(1); // Monday
  const [emails, setEmails] = useState<string[]>([""]);

  const cron = cronFor(preset, hour, minute, dow);

  function updateEmail(index: number, value: string) {
    setEmails((prev) => prev.map((e, i) => (i === index ? value : e)));
  }

  function addEmail() {
    setEmails((prev) => [...prev, ""]);
  }

  function removeEmail(index: number) {
    setEmails((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmed = emails.map((v) => v.trim()).filter(Boolean);
    if (trimmed.length === 0) {
      toast.error("At least one recipient email is required.");
      return;
    }
    if (!name.trim()) {
      toast.error("Name is required.");
      return;
    }

    startTransition(async () => {
      const res = await createScheduledReport({
        name: name.trim(),
        reportType,
        format,
        cronExpression: cron,
        recipientEmails: trimmed,
      });
      if (res.ok) {
        toast.success("Scheduled report created");
        router.push("/reports/scheduled");
      } else {
        toast.error(res.error ?? "Failed to create report");
      }
    });
  }

  return (
    <form className="grid gap-6 lg:grid-cols-2" onSubmit={handleSubmit}>
      {/* Left — basics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Basics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sr-name">Name</Label>
            <Input
              id="sr-name"
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
              placeholder="Weekly Stock Value"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sr-type">Report</Label>
            <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
              <SelectTrigger id="sr-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(REPORT_LABELS) as ReportType[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {REPORT_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sr-format">Format</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as Format)}>
              <SelectTrigger id="sr-format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PDF">PDF</SelectItem>
                <SelectItem value="XLSX">Excel (XLSX)</SelectItem>
                <SelectItem value="CSV">CSV</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Right — schedule + recipients */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Schedule</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sr-preset">Frequency</Label>
            <Select value={preset} onValueChange={(v) => setPreset(v as SchedulePreset)}>
              <SelectTrigger id="sr-preset">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekday">Weekday (Mon fallback)</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly (day 1)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="sr-hour">Hour (0-23)</Label>
              <Input
                id="sr-hour"
                type="number"
                min={0}
                max={23}
                value={hour}
                onChange={(e) => setHour(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sr-min">Minute (0-59)</Label>
              <Input
                id="sr-min"
                type="number"
                min={0}
                max={59}
                value={minute}
                onChange={(e) => setMinute(Number(e.target.value))}
              />
            </div>
          </div>

          {preset === "weekly" && (
            <div className="space-y-2">
              <Label htmlFor="sr-dow">Day of week</Label>
              <Select value={String(dow)} onValueChange={(v) => setDow(Number(v))}>
                <SelectTrigger id="sr-dow">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Sunday</SelectItem>
                  <SelectItem value="1">Monday</SelectItem>
                  <SelectItem value="2">Tuesday</SelectItem>
                  <SelectItem value="3">Wednesday</SelectItem>
                  <SelectItem value="4">Thursday</SelectItem>
                  <SelectItem value="5">Friday</SelectItem>
                  <SelectItem value="6">Saturday</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="rounded-md bg-muted/50 p-3 text-xs">
            <span className="text-muted-foreground">Cron expression:</span>{" "}
            <code className="font-mono">{cron}</code>
          </div>
        </CardContent>
      </Card>

      {/* Recipients full row */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Recipients</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {emails.map((email, i) => (
            <div key={`row-${i}`} className="flex gap-2">
              <Input
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => updateEmail(i, e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeEmail(i)}
                disabled={emails.length === 1}
                title="Remove"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addEmail}>
            <Plus className="mr-1 h-3 w-3" />
            Add recipient
          </Button>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="lg:col-span-2 flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/reports/scheduled")}
          disabled={pending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Create
        </Button>
      </div>
    </form>
  );
}
