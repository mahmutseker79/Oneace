"use client";

import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { acceptInvitationAction } from "@/app/(app)/users/actions";

export type AcceptInviteButtonLabels = {
  accept: string;
  accepting: string;
  successTitle: string;
  successBody: string;
  goToDashboard: string;
};

type AcceptInviteButtonProps = {
  token: string;
  labels: AcceptInviteButtonLabels;
};

/**
 * Sprint 20: the single Accept CTA rendered on `/invite/[token]` when
 * the authenticated user's email matches the invite. We deliberately
 * keep the success state on the client (no router.push) so the user
 * sees a confirmation before deciding to jump to the dashboard — if
 * they're accepting on a phone they might want to screenshot the
 * confirmation for their records.
 */
export function AcceptInviteButton({ token, labels }: AcceptInviteButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await acceptInvitationAction(token);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAccepted(true);
    });
  }

  if (accepted) {
    return (
      <div className="space-y-3 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm dark:border-emerald-900/50 dark:bg-emerald-950/30">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-medium text-emerald-900 dark:text-emerald-100">
              {labels.successTitle}
            </p>
            <p className="text-emerald-800 dark:text-emerald-200">{labels.successBody}</p>
          </div>
        </div>
        <Button asChild size="sm">
          <Link href="/">{labels.goToDashboard}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button type="button" onClick={handleClick} disabled={isPending}>
        {isPending ? labels.accepting : labels.accept}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
