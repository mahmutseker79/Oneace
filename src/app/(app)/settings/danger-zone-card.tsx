"use client";

import { AlertTriangle } from "lucide-react";
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

import { deleteOrganizationAction } from "./actions";

export type DangerZoneLabels = {
  heading: string;
  description: string;
  /** Long-form bulleted-style consequences list. One string per consequence. */
  consequences: readonly string[];
  deleteCta: string;
  confirmTitle: string;
  /** Body copy for the confirm dialog. Uses `{org}` placeholder. */
  confirmBody: string;
  /** Label for the slug-echo input. Uses `{slug}` placeholder. */
  confirmInputLabel: string;
  confirmInputPlaceholder: string;
  confirmMismatch: string;
  confirmCta: string;
  cancel: string;
  deleting: string;
  forbidden: string;
};

type DangerZoneCardProps = {
  organization: {
    name: string;
    slug: string;
  };
  canDelete: boolean;
  labels: DangerZoneLabels;
};

export function DangerZoneCard({ organization, canDelete, labels }: DangerZoneCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);

  const clientSideMatches = confirmation.trim() === organization.slug;

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      // Reset when the dialog closes so reopening starts from a clean
      // slate — we don't want a stale "mismatch" error hanging around.
      setConfirmation("");
      setError(null);
    }
  }

  function handleConfirm() {
    if (!canDelete) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteOrganizationAction(confirmation);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Navigate AFTER the cookie has been updated on the server. Use
      // router.push (not replace) so the back button doesn't let them
      // rewind onto a stale /settings for a deleted org.
      setOpen(false);
      router.push(result.nextPath);
      router.refresh();
    });
  }

  return (
    <Card variant="destructive" className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
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

        {canDelete ? (
          <AlertDialog open={open} onOpenChange={handleOpenChange}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">{labels.deleteCta}</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{labels.confirmTitle}</AlertDialogTitle>
                <AlertDialogDescription>
                  {labels.confirmBody.replace("{org}", organization.name)}
                </AlertDialogDescription>
              </AlertDialogHeader>

              <div className="space-y-1.5">
                <Label htmlFor="delete-confirm">
                  {labels.confirmInputLabel.replace("{slug}", organization.slug)}
                </Label>
                <Input
                  id="delete-confirm"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  placeholder={labels.confirmInputPlaceholder.replace("{slug}", organization.slug)}
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
                  disabled={isPending || !clientSideMatches}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isPending ? labels.deleting : labels.confirmCta}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <p className="text-xs text-muted-foreground">{labels.forbidden}</p>
        )}
      </CardContent>
    </Card>
  );
}
