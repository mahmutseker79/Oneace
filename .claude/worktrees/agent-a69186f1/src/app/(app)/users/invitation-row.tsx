"use client";

import { Check, Copy, Trash2 } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";

import { revokeInvitationAction } from "./actions";

export type InvitationRowLabels = {
  revoke: string;
  revokeTitle: string;
  revokeBody: string;
  revokeConfirm: string;
  cancel: string;
  copyLink: string;
  copied: string;
};

type InvitationRowProps = {
  invitation: {
    id: string;
    email: string;
    roleLabel: string;
    inviterName: string;
    expires: string;
    url: string;
  };
  canManage: boolean;
  labels: InvitationRowLabels;
};

export function InvitationRow({ invitation, canManage, labels }: InvitationRowProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(invitation.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable; silently drop.
    }
  }

  function handleRevoke() {
    setError(null);
    startTransition(async () => {
      const result = await revokeInvitationAction(invitation.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRevokeOpen(false);
      router.refresh();
    });
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{invitation.email}</TableCell>
      <TableCell>
        <Badge variant="outline">{invitation.roleLabel}</Badge>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{invitation.inviterName}</TableCell>
      <TableCell className="text-sm text-muted-foreground">{invitation.expires}</TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={handleCopy}>
            {copied ? (
              <>
                <Check className="mr-1 h-3.5 w-3.5" />
                {labels.copied}
              </>
            ) : (
              <>
                <Copy className="mr-1 h-3.5 w-3.5" />
                {labels.copyLink}
              </>
            )}
          </Button>
          {canManage ? (
            <AlertDialog open={revokeOpen} onOpenChange={setRevokeOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">{labels.revoke}</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{labels.revokeTitle}</AlertDialogTitle>
                  <AlertDialogDescription>{labels.revokeBody}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isPending}>{labels.cancel}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => {
                      e.preventDefault();
                      handleRevoke();
                    }}
                    disabled={isPending}
                  >
                    {labels.revokeConfirm}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
        </div>
        {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
      </TableCell>
    </TableRow>
  );
}
