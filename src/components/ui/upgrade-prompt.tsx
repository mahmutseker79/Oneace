/**
 * Phase 13.3 — UpgradePrompt component.
 *
 * A compact, consistent upgrade call-to-action used across plan-gated
 * surfaces. Three variants:
 *
 *   "banner"  — inline alert bar, used at the top of a page/section
 *   "card"    — standalone card, used for fully blocked features
 *   "inline"  — small inline badge/link, used next to disabled buttons
 *
 * All variants link to /settings/billing (the upgrade entry point).
 * Copy is short and specific — never generic "upgrade required".
 */

import { ArrowRight, Lock } from "lucide-react";
import Link from "next/link";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type UpgradePromptVariant = "banner" | "card" | "inline";

export type UpgradePromptProps = {
  /** What the user is trying to do / what is blocked. */
  reason: string;
  /** Which plan unlocks this feature: "PRO" | "BUSINESS". */
  requiredPlan: "PRO" | "BUSINESS";
  variant?: UpgradePromptVariant;
  /** Optional extra context for "card" variant. */
  description?: string;
};

const PLAN_LABEL: Record<"PRO" | "BUSINESS", string> = {
  PRO: "Pro",
  BUSINESS: "Business",
};

export function UpgradePrompt({
  reason,
  requiredPlan,
  variant = "banner",
  description,
}: UpgradePromptProps) {
  const planLabel = PLAN_LABEL[requiredPlan];
  const upgradeHref = "/settings/billing";

  if (variant === "inline") {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Badge variant="secondary" className="gap-1 text-xs">
          <Lock className="h-2.5 w-2.5" />
          {planLabel}
        </Badge>
        <Link href={upgradeHref} className="text-xs text-primary hover:underline">
          Upgrade
        </Link>
      </span>
    );
  }

  if (variant === "card") {
    return (
      <Card className="border-warning/60 bg-warning-light">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="h-4 w-4 text-warning" />
            {reason}
            <Badge variant="secondary" className="ml-1 text-xs">
              {planLabel} plan
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          <Button asChild size="sm">
            <Link href={upgradeHref}>
              Upgrade to {planLabel}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // variant === "banner"
  return (
    <Alert className="border-warning/60 bg-warning-light">
      <Lock className="h-4 w-4 text-warning" />
      <AlertDescription className="flex items-center justify-between gap-4">
        <span className="text-sm">
          {reason}{" "}
          <span className="text-muted-foreground">Available on {planLabel} and above.</span>
        </span>
        <Button asChild size="sm" variant="outline" className="shrink-0">
          <Link href={upgradeHref}>Upgrade to {planLabel}</Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
}
