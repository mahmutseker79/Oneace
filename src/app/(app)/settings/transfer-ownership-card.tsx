"use client";

import { KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { transferOrganizationAction } from "./actions";

/**
 * Sprint 32: transfer-ownership card, shown on the settings page
 * above the danger zone. OWNER-only. The visual language is
 * "advisory destructive" — KeyRound icon instead of AlertTriangle,
 * warning-amber not full destructive-red — because unlike
 * delete-org, transfer does not destroy data, but it is still
 * irreversible from the caller's perspective without the new
 * owner's help.
 */
export type TransferOwnershipLabels = {
  heading: string;
  description: string;
  targetLabel: string;
  targetPlaceholder: string;
  noCandidates: string;
  /** Long-form bulleted consequences list. One string per consequence. */
  consequences: readonly string[];
  /** Input label for the slug-echo confirmation. Uses `{slug}` placeholder. */
  confirmInputLabel: string;
  confirmInputPlaceholder: string;
  confirmMismatch: string;
  transferCta: string;
  transferring: string;
  /** Body copy for the confirm dialog. Uses `{name}` placeholder. */
  confirmBody: string;
  /** Success toast. Uses `{name}` placeholder. */
  success: string;
  cancel: string;
  forbidden: string;
};

export type TransferCandidate = {
  /** Membership id — what the server action takes. */
  id: string;
  /** Display name (falls back to email in the caller). */
  name: string;
  /** Email, shown under the name for disambiguation when two members share a first name. */
  email: string;
  /** Current role label, already translated by the caller. */
  roleLabel: string;
};

type TransferOwnershipCardProps = {
  organization: {
    name: string;
    slug: string;
  };
  canTransfer: boolean;
  candidates: readonly TransferCandidate[];
  labels: TransferOwnershipLabels;
};

export function TransferOwnershipCard({
  organization,
  canTransfer,
  candidates,
  labels,
}: TransferOwnershipCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [targetId, setTargetId] = useState<string>("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const selectedTarget = candidates.find((c) => c.id === targetId) ?? null;
  const clientSideMatches = confirmation.trim() === organization.slug;
  const hasCandidates = candidates.length > 0;

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      // Reset on close so reopening starts fresh — we don't want a
      // stale mismatch error or half-typed slug hanging around.
      setConfirmation("");
      setError(null);
    }
  }

  function handleConfirm() {
    if (!canTransfer) return;
    if (!selectedTarget) return;
    setError(null);
    const targetName = selectedTarget.name;
    startTransition(async () => {
      const result = await transferOrganizationAction(selectedTarget.id, confirmation);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setTargetId("");
      setConfirmation("");
      // Show the success toast BEFORE refreshing. router.refresh()
      // re-renders the server tree, which will drop this card
      // entirely once the caller's role is re-read as ADMIN, so the
      // toast needs to live somewhere that survives unmount — we
      // can't rely on state here. Use the parent-level output
      // surface from the banner pattern... but simpler: stash the
      // message in state just long enough to be announced by the
      // live region before router.refresh() unmounts us.
      setSuccessMessage(labels.success.replace("{name}", targetName));
      router.refresh();
    });
  }

  return (
    <Card variant="warning" className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-warning">
          <KeyRound className="h-5 w-5" aria-hidden="true" />
          {labels.heading}
        </CardTitle>
        <CardDescription>{labels.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          {labels.consequences.map((line) => (
            <li key={line} className="flex gap-2">
              <span aria-hidden="true">•</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>

        {!canTransfer ? (
          <p className="text-xs text-muted-foreground">{labels.forbidden}</p>
        ) : !hasCandidates ? (
          <p className="text-xs text-muted-foreground">{labels.noCandidates}</p>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="transfer-target">{labels.targetLabel}</Label>
              <Select value={targetId} onValueChange={setTargetId} disabled={isPending}>
                <SelectTrigger id="transfer-target">
                  <SelectValue placeholder={labels.targetPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((candidate) => (
                    <SelectItem key={candidate.id} value={candidate.id}>
                      <span className="flex flex-col">
                        <span className="font-medium">{candidate.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {candidate.email} · {candidate.roleLabel}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <AlertDialog open={open} onOpenChange={handleOpenChange}>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="border-warning text-warning hover:bg-warning/5"
                  disabled={!selectedTarget || isPending}
                >
                  {labels.transferCta}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{labels.heading}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {labels.confirmBody
                      .replace("{name}", selectedTarget?.name ?? "")
                      .replace("{org}", organization.name)}
                  </AlertDialogDescription>
                </AlertDialogHeader>

                <div className="space-y-1.5">
                  <Label htmlFor="transfer-confirm">
                    {labels.confirmInputLabel.replace("{slug}", organization.slug)}
                  </Label>
                  <Input
                    id="transfer-confirm"
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                    placeholder={labels.confirmInputPlaceholder.replace(
                      "{slug}",
                      organization.slug,
                    )}
                    autoComplete="off"
                    disabled={isPending}
                  />
                  {confirmation.length > 0 && !clientSideMatches ? (
                    <p className="text-xs text-muted-foreground">{labels.confirmMismatch}</p>
                  ) : null}
                  {error ? <p className="text-xs text-destructive">{error}</p> : null}
                </div>

                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isPending}>{labels.cancel}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => {
                      e.preventDefault();
                      handleConfirm();
                    }}
                    disabled={isPending || !clientSideMatches || !selectedTarget}
                  >
                    {isPending ? labels.transferring : labels.transferCta}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}

        {/* Live region for the success toast. Kept inside the card so
            screen readers announce the hand-off before router.refresh()
            re-renders the tree without this component. */}
        <output aria-live="polite" className="sr-only">
          {successMessage ?? ""}
        </output>
      </CardContent>
    </Card>
  );
}
