import { MailX, Users } from "lucide-react";
import type { Metadata } from "next";

import { WrapperTabs } from "@/components/shell/wrapper-tabs";
import { TEAM_TAB_SPECS, resolveWrapperTabs } from "@/components/shell/wrapper-tabs-config";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UpgradePrompt } from "@/components/ui/upgrade-prompt";
import { Role } from "@/generated/prisma";
import { db } from "@/lib/db";
import { getMessages, getRegion } from "@/lib/i18n";
import { buildInvitationUrl } from "@/lib/invitations";
import { checkPlanLimit } from "@/lib/plans";
import { requireCapability } from "@/lib/session";

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
  [Role.APPROVER]: 5,
  [Role.COUNTER]: 6,
};

const roleOptions = Object.values(Role).map((role) => ({
  value: role,
  label: role,
}));

const dateTimeFmt = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

const dateFmt = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
});

export default async function UsersPage() {
  // P0-5 — capability guard. Users page exposes the team list and invite
  // flow; anyone who couldn't invite shouldn't be able to read the list.
  const { membership, session } = await requireCapability("team.invite");
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

  // Phase 15.3 — member limit nudge for over-limit FREE orgs
  const memberPlan = membership.organization.plan as "FREE" | "PRO" | "BUSINESS";
  const effectiveMemberCount = memberships.length + pendingInvitations.length;
  const memberLimitCheck = checkPlanLimit(memberPlan, "members", effectiveMemberCount);
  // Show nudge when: over limit (retroactive downgrade) OR at limit (can't add more)
  const showMemberLimitNudge = !memberLimitCheck.allowed;

  const sorted = [...memberships].sort((a, b) => {
    const roleDiff = ROLE_ORDER[a.role] - ROLE_ORDER[b.role];
    if (roleDiff !== 0) return roleDiff;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  const inviteRoleOptions = Object.entries(t.users.roles ?? {}).map(([key, label]) => ({
    value: key,
    label: label as string,
  }));

  return (
    <div className="space-y-6">
      <WrapperTabs tabs={resolveWrapperTabs(TEAM_TAB_SPECS, t)} ariaLabel="Team sections" />
      <PageHeader
        title={t.users.heading}
        description={t.users.subtitle}
        // v1.5 step 9 — IA reshuffled Members/Departments out of
        // Settings into their own 'Team' wrapper. /users is now the
        // Team landing so a single-item crumb matches how /settings
        // itself renders.
        breadcrumb={[{ label: t.users.heading }]}
      />

      {/* Phase 15.3 — member limit nudge */}
      {showMemberLimitNudge && !memberLimitCheck.allowed ? (
        <UpgradePrompt
          reason={`Your workspace has ${effectiveMemberCount} members. Your current plan includes ${memberLimitCheck.limit}.`}
          requiredPlan={memberLimitCheck.limit <= 3 ? "PRO" : "BUSINESS"}
          variant="banner"
        />
      ) : null}

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>{t.users.invite.heading}</CardTitle>
            <CardDescription>{t.users.invite.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <InviteForm
              defaultRole={Role.MEMBER}
              locale={region.numberLocale}
              labels={{
                emailLabel: t.users.invite.emailLabel,
                emailPlaceholder: t.users.invite.emailPlaceholder,
                roleLabel: t.users.invite.roleLabel,
                submit: t.users.invite.submit,
                successEmailSent: t.users.invite.successEmailSent,
                successLinkOnly: t.users.invite.successLinkOnly,
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
              // Sprint 17 PR #1 (UX/UI audit Apr-25 §B-7): inline ternary empty → EmptyState (bare).
              <EmptyState icon={MailX} title={t.users.invitations.empty} bare />
            ) : (
              <div className="overflow-x-auto">
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
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t.users.table.heading}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="hidden md:block overflow-x-auto">
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
          </div>

          {/* Phase 7B: Mobile card view */}
          {sorted.length === 0 ? (
            // Sprint 17 PR #1 (UX/UI audit Apr-25 §B-7): inline ternary empty → EmptyState (bare, mobile-only).
            <div className="md:hidden">
              <EmptyState icon={Users} title={t.users.table.empty} bare />
            </div>
          ) : (
            <div className="space-y-2 md:hidden">
              {sorted.map((m) => (
                <Card key={m.id} className="p-3">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm break-words">
                          {m.user.name ?? m.user.email}
                          {m.user.id === session.user.id && (
                            <span className="ml-1 text-xs text-muted-foreground">
                              ({t.users.table.you})
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground break-words">{m.user.email}</p>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>{t.users.roles[m.role]}</p>
                      <p>Joined: {dateFmt.format(m.createdAt)}</p>
                    </div>
                    <div className="flex gap-1 pt-2">
                      <MemberRow
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
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
