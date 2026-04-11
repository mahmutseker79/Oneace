import type { Metadata } from "next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Role } from "@/generated/prisma";
import { db } from "@/lib/db";
import { getMessages, getRegion } from "@/lib/i18n";
import { buildInvitationUrl } from "@/lib/invitations";
import { requireActiveMembership } from "@/lib/session";

import { InvitationRow } from "./invitation-row";
import { InviteForm } from "./invite-form";
import { MemberRow } from "./member-row";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.users.metaTitle };
}

const ROLE_ORDER: Record<Role, number> = {
  [Role.OWNER]: 0,
  [Role.ADMIN]: 1,
  [Role.MANAGER]: 2,
  [Role.MEMBER]: 3,
  [Role.VIEWER]: 4,
};

export default async function UsersPage() {
  const { membership, session } = await requireActiveMembership();
  const t = await getMessages();
  const region = await getRegion();

  const canManage = membership.role === Role.OWNER || membership.role === Role.ADMIN;

  const [memberships, pendingInvitations] = await Promise.all([
    db.membership.findMany({
      where: { organizationId: membership.organizationId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    // Sprint 20: pending = not accepted, not revoked, not expired. The
    // three-predicate filter mirrors what `classifyInvitation` would say
    // so the table stays consistent with the accept-page state machine.
    db.invitation.findMany({
      where: {
        organizationId: membership.organizationId,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        invitedBy: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const sorted = [...memberships].sort((a, b) => {
    const roleDiff = ROLE_ORDER[a.role] - ROLE_ORDER[b.role];
    if (roleDiff !== 0) return roleDiff;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  const dateFmt = new Intl.DateTimeFormat(region.numberLocale, { dateStyle: "medium" });
  const dateTimeFmt = new Intl.DateTimeFormat(region.numberLocale, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const roleOptions = [
    { value: Role.OWNER, label: t.users.roles.OWNER },
    { value: Role.ADMIN, label: t.users.roles.ADMIN },
    { value: Role.MANAGER, label: t.users.roles.MANAGER },
    { value: Role.MEMBER, label: t.users.roles.MEMBER },
    { value: Role.VIEWER, label: t.users.roles.VIEWER },
  ];

  // Only an OWNER may promote someone else to OWNER — hide that option for others.
  const inviteRoleOptions = roleOptions.filter((opt) =>
    opt.value === Role.OWNER ? membership.role === Role.OWNER : true,
  );

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t.users.heading}</h1>
        <p className="text-muted-foreground">{t.users.subtitle}</p>
      </div>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>{t.users.invite.heading}</CardTitle>
            <CardDescription>{t.users.invite.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <InviteForm
              defaultRole={Role.MEMBER}
              dateFmt={dateTimeFmt}
              labels={{
                emailLabel: t.users.invite.emailLabel,
                emailPlaceholder: t.users.invite.emailPlaceholder,
                roleLabel: t.users.invite.roleLabel,
                submit: t.users.invite.submit,
                success: t.users.invite.success,
                linkHeading: t.users.invite.linkHeading,
                linkHelp: t.users.invite.linkHelp,
                copy: t.users.invite.copy,
                copied: t.users.invite.copied,
                roleOptions: inviteRoleOptions,
              }}
            />
          </CardContent>
        </Card>
      ) : null}

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>{t.users.invitations.heading}</CardTitle>
            <CardDescription>{t.users.invitations.description}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {pendingInvitations.length === 0 ? (
              <p className="px-6 py-4 text-sm text-muted-foreground">{t.users.invitations.empty}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.users.invitations.columnEmail}</TableHead>
                    <TableHead>{t.users.invitations.columnRole}</TableHead>
                    <TableHead>{t.users.invitations.columnInvitedBy}</TableHead>
                    <TableHead>{t.users.invitations.columnExpires}</TableHead>
                    <TableHead className="text-right">
                      {t.users.invitations.columnActions}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingInvitations.map((inv) => (
                    <InvitationRow
                      key={inv.id}
                      canManage={canManage}
                      invitation={{
                        id: inv.id,
                        email: inv.email,
                        roleLabel: t.users.roles[inv.role],
                        inviterName: inv.invitedBy.name ?? inv.invitedBy.email,
                        expires: dateTimeFmt.format(inv.expiresAt),
                        url: buildInvitationUrl(inv.token),
                      }}
                      labels={{
                        revoke: t.users.invitations.revoke,
                        revokeTitle: t.users.invitations.revokeTitle,
                        revokeBody: t.users.invitations.revokeBody,
                        revokeConfirm: t.users.invitations.revokeConfirm,
                        cancel: t.common.cancel,
                        copyLink: t.users.invitations.copyLink,
                        copied: t.users.invitations.copied,
                      }}
                    />
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t.users.table.heading}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.users.table.columnName}</TableHead>
                <TableHead>{t.users.table.columnEmail}</TableHead>
                <TableHead>{t.users.table.columnRole}</TableHead>
                <TableHead>{t.users.table.columnJoined}</TableHead>
                <TableHead className="text-right">{t.users.table.columnActions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-sm text-muted-foreground">
                    {t.users.table.empty}
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((m) => (
                  <MemberRow
                    key={m.id}
                    isSelf={m.user.id === session.user.id}
                    canManage={canManage}
                    member={{
                      id: m.id,
                      role: m.role,
                      joined: dateFmt.format(m.createdAt),
                      name: m.user.name ?? m.user.email,
                      email: m.user.email,
                    }}
                    labels={{
                      you: t.users.table.you,
                      remove: t.users.actions.removeMember,
                      removeTitle: t.users.actions.removeConfirmTitle,
                      removeBody: t.users.actions.removeConfirmBody,
                      removeConfirm: t.users.actions.removeConfirmCta,
                      cancel: t.common.cancel,
                      roleOptions,
                    }}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
