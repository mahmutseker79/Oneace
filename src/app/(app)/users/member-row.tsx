"use client";

import { Trash2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableCell, TableRow } from "@/components/ui/table";

import { removeMemberAction, updateMemberRoleAction } from "./actions";

export type RoleOption = { value: string; label: string };

export type MemberRowLabels = {
  you: string;
  remove: string;
  removeTitle: string;
  removeBody: string;
  removeConfirm: string;
  cancel: string;
  roleOptions: RoleOption[];
};

type MemberRowProps = {
  member: {
    id: string;
    role: string;
    joined: string;
    name: string;
    email: string;
  };
  isSelf: boolean;
  canManage: boolean;
  labels: MemberRowLabels;
};

export function MemberRow({ member, isSelf, canManage, labels }: MemberRowProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [role, setRole] = useState(member.role);
  const [error, setError] = useState<string | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);

  function handleRoleChange(next: string) {
    if (next === role) return;
    const previous = role;
    setRole(next);
    setError(null);
    startTransition(async () => {
      const result = await updateMemberRoleAction(member.id, next);
      if (!result.ok) {
        setRole(previous);
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function handleRemove() {
    setError(null);
    startTransition(async () => {
      const result = await removeMemberAction(member.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRemoveOpen(false);
      router.refresh();
    });
  }

  return (
    <TableRow>
      <TableCell className="font-medium">
        {member.name}
        {isSelf ? (
          <Badge variant="secondary" className="ml-2 text-[10px] uppercase">
            {labels.you}
          </Badge>
        ) : null}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{member.email}</TableCell>
      <TableCell>
        {canManage && !isSelf ? (
          <Select value={role} onValueChange={handleRoleChange} disabled={isPending}>
            <SelectTrigger className="h-8 w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {labels.roleOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Badge variant="outline">
            {labels.roleOptions.find((o) => o.value === role)?.label ?? role}
          </Badge>
        )}
        {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{member.joined}</TableCell>
      <TableCell className="text-right">
        {canManage && !isSelf ? (
          <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">{labels.remove}</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{labels.removeTitle}</AlertDialogTitle>
                <AlertDialogDescription>{labels.removeBody}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isPending}>{labels.cancel}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    handleRemove();
                  }}
                  disabled={isPending}
                >
                  {labels.removeConfirm}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </TableCell>
    </TableRow>
  );
}
