"use client";

import { CheckCircle2, Info, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { useUnsavedWarning } from "@/hooks/use-unsaved-warning";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
// Audit v1.2 §5.33 — FIRST_COUNT_COMPLETED is the activation event
// product cares about ("did the user get all the way through a cycle?").
// We fire from the client because track() is a server-side no-op.
import { AnalyticsEvents } from "@/lib/analytics/events";
import { track } from "@/lib/instrumentation";

import { completeStockCountAction } from "../../actions";

export type ReconcileFormLabels = {
  consequenceTitle: string;
  consequenceBody: string;
  applyLabel: string;
  applyHelp: string;
  applyWarning: string;
  submit: string;
  successTitle: string;
  successBody: (posted: number) => string;
  successBodyNone: string;
  viewCount: string;
  viewAll: string;
  genericError: string;
};

type ReconcileFormProps = {
  countId: string;
  labels: ReconcileFormLabels;
};

// Keeps the reconcile trigger + toggle in a small client island so the
// parent reconcile page can stay a server component and pre-render the
// variance tables from the same pure calc.
export function ReconcileForm({ countId, labels }: ReconcileFormProps) {
  const router = useRouter();
  const { reset: resetUnsaved } = useUnsavedWarning();
  const [applyAdjustments, setApplyAdjustments] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [posted, setPosted] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await completeStockCountAction({
        countId,
        applyAdjustments,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // v1.2 §5.33 — fire only when the server action reports this
      // was the first-ever completed count for the org. The server
      // computes this from a prior-completed count === 0 check BEFORE
      // the transaction that flips state to COMPLETED, so the signal
      // is stable even under concurrent reconciles.
      if (result.isFirstCompleted) {
        track(AnalyticsEvents.FIRST_COUNT_COMPLETED, {
          id: result.id,
          postedMovements: result.postedMovements,
        });
      }
      setPosted(result.postedMovements);
      setDone(true);
      resetUnsaved();
      router.refresh();
    });
  }

  if (done) {
    const body =
      posted !== null && posted > 0 ? labels.successBody(posted) : labels.successBodyNone;
    return (
      <output className="block space-y-4 rounded-md border border-success/40 bg-success/10 p-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-success" />
          <div className="space-y-1">
            <p className="font-semibold">{labels.successTitle}</p>
            <p className="text-sm text-muted-foreground">{body}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" asChild>
            <Link href={`/stock-counts/${countId}`}>{labels.viewCount}</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/stock-counts">{labels.viewAll}</Link>
          </Button>
        </div>
      </output>
    );
  }

  return (
    <div className="space-y-4">
      {/* P7.3 — Pre-completion trust messaging */}
      <Alert className="border-info/50 bg-info/10">
        <Info className="h-4 w-4" />
        <AlertTitle className="text-sm">{labels.consequenceTitle}</AlertTitle>
        <AlertDescription className="text-xs">{labels.consequenceBody}</AlertDescription>
      </Alert>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-start gap-3 rounded-md border p-4">
          <Checkbox
            id="apply-adjustments"
            checked={applyAdjustments}
            onCheckedChange={(value) => setApplyAdjustments(value === true)}
          />
          <div className="space-y-1">
            <Label htmlFor="apply-adjustments" className="cursor-pointer">
              {labels.applyLabel}
            </Label>
            <p className="text-xs text-muted-foreground">{labels.applyHelp}</p>
            {!applyAdjustments ? (
              <p className="text-xs text-warning">{labels.applyWarning}</p>
            ) : null}
          </div>
        </div>

        {error ? (
          <div
            role="alert"
            className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {labels.submit}
          </Button>
        </div>
      </form>
    </div>
  );
}
