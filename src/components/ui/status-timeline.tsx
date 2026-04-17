"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import React from "react";

export interface TimelineStep {
  label: string;
  /** Whether this step is completed */
  completed?: boolean;
  /** Whether this is the currently active step */
  active?: boolean;
  /** Optional description for the step */
  description?: string;
}

interface StatusTimelineProps {
  steps: TimelineStep[];
  className?: string;
  /** Vertical layout for mobile */
  orientation?: "horizontal" | "vertical";
}

export function StatusTimeline({
  steps,
  className,
  orientation = "horizontal",
}: StatusTimelineProps) {
  if (orientation === "vertical") {
    return (
      <div className={cn("flex flex-col gap-0", className)}>
        {steps.map((step, i) => (
          <div key={i} className="flex gap-3">
            {/* Connector line + dot */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                  step.completed
                    ? "border-success bg-success text-success-foreground"
                    : step.active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted text-muted-foreground",
                )}
              >
                {step.completed ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              {i < steps.length - 1 && (
                <div
                  className={cn(
                    "w-0.5 flex-1 min-h-[24px]",
                    step.completed ? "bg-success" : "bg-border",
                  )}
                />
              )}
            </div>

            {/* Content */}
            <div className="pb-6 pt-0.5 min-w-0">
              <p
                className={cn(
                  "text-sm font-medium",
                  step.active
                    ? "text-primary"
                    : step.completed
                      ? "text-foreground"
                      : "text-muted-foreground",
                )}
              >
                {step.label}
              </p>
              {step.description && (
                <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-0", className)}>
      {steps.map((step, i) => (
        <React.Fragment key={i}>
          {/* Step circle */}
          <div className="flex flex-col items-center gap-1.5 min-w-0">
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                step.completed
                  ? "border-success bg-success text-success-foreground"
                  : step.active
                    ? "border-primary bg-primary/10 text-primary ring-4 ring-primary/10"
                    : "border-border bg-muted text-muted-foreground",
              )}
            >
              {step.completed ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <p
              className={cn(
                "text-[11px] font-medium text-center max-w-[80px] leading-tight",
                step.active
                  ? "text-primary"
                  : step.completed
                    ? "text-foreground"
                    : "text-muted-foreground",
              )}
            >
              {step.label}
            </p>
          </div>

          {/* Connector line */}
          {i < steps.length - 1 && (
            <div
              className={cn(
                "h-0.5 flex-1 min-w-[20px] -mt-5",
                step.completed ? "bg-success" : "bg-border",
              )}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
