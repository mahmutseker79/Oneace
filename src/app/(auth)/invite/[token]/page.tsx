import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { getMessages, getRegion } from "@/lib/i18n";
import { classifyInvitation } from "@/lib/invitations";
import { getCurrentSession } from "@/lib/session";

import { AcceptInviteButton } from "./accept-invite-button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.invitePage.metaTitle };
}

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function InviteAcceptPage({ params }: PageProps) {
  const { token } = await params;
  const t = await getMessages();
  const region = await getRegion();

  // We load the invite up front so we can render org/inviter details
  // regardless of auth state (even if the user still has to sign in).
  // The token is a capability — knowing it grants you the right to
  // SEE the invite. Actually accepting still requires matching email.
  const invite = await db.invitation.findUnique({
    where: { token },
    select: {
      id: true,
      email: true,
      role: true,
      expiresAt: true,
      acceptedAt: true,
      revokedAt: true,
      organization: { select: { id: true, name: true } },
      invitedBy: { select: { name: true, email: true } },
    },
  });

  // `getCurrentSession` is nullable — we explicitly do NOT redirect
  // unauthenticated users. Instead we show them the invite details +
  // a "Sign in to accept" card so they know what they're about to
  // commit to before signing in.
  const session = await getCurrentSession();

  if (!invite) {
    return (
      <InviteShell heading={t.invitePage.notFoundTitle}>
        <p className="text-sm text-muted-foreground">{t.invitePage.errors.notFound}</p>
        <div className="pt-2">
          <Link href="/" className="text-sm font-medium text-primary hover:underline">
            {t.invitePage.backToHome}
          </Link>
        </div>
      </InviteShell>
    );
  }

  const status = classifyInvitation(invite);
  const dateFmt = new Intl.DateTimeFormat(region.numberLocale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const roleLabel = t.users.roles[invite.role];
  const inviterName = invite.invitedBy.name ?? invite.invitedBy.email;

  // Dead states: accepted / revoked / expired — same shell, different
  // body copy. No action available in any of them.
  if (status !== "pending") {
    const bodyKey =
      status === "accepted"
        ? t.invitePage.errors.alreadyAccepted
        : status === "revoked"
          ? t.invitePage.errors.revoked
          : t.invitePage.errors.expired;
    return (
      <InviteShell heading={t.invitePage.cannotAcceptTitle}>
        <p className="text-sm text-muted-foreground">{bodyKey}</p>
        <InviteSummary
          orgName={invite.organization.name}
          inviterName={inviterName}
          roleLabel={roleLabel}
          labels={{
            orgLabel: t.invitePage.orgLabel,
            inviterLabel: t.invitePage.inviterLabel,
            roleLabel: t.invitePage.roleLabelLabel,
          }}
        />
        <div className="pt-2">
          <Link href="/" className="text-sm font-medium text-primary hover:underline">
            {t.invitePage.backToHome}
          </Link>
        </div>
      </InviteShell>
    );
  }

  // Pending state. Branch on sign-in status:
  //   - no session: show details + "Sign in" CTA
  //   - wrong email: show "signed in as X but invite is for Y"
  //   - email matches: show Accept button
  if (!session) {
    return (
      <InviteShell heading={t.invitePage.pendingTitle} subheading={t.invitePage.pendingSubtitle}>
        <InviteSummary
          orgName={invite.organization.name}
          inviterName={inviterName}
          roleLabel={roleLabel}
          labels={{
            orgLabel: t.invitePage.orgLabel,
            inviterLabel: t.invitePage.inviterLabel,
            roleLabel: t.invitePage.roleLabelLabel,
          }}
        />
        <p className="text-xs text-muted-foreground">
          {t.invitePage.expiresAt.replace("{date}", dateFmt.format(invite.expiresAt))}
        </p>
        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          {t.invitePage.signInRequired.replace("{email}", invite.email)}
        </div>
        <div className="flex flex-col gap-2">
          {/* Sprint 33: pass `?next=/invite/{token}` through so the
              user lands back here after sign-in or sign-up. The
              register form also detects the `/invite/` prefix and
              skips its org-creation step, since invitees join an
              existing org. */}
          <Button asChild>
            <Link href={`/login?next=/invite/${encodeURIComponent(token)}`}>
              {t.invitePage.signInCta}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/register?next=/invite/${encodeURIComponent(token)}`}>
              {t.invitePage.createAccountCta}
            </Link>
          </Button>
        </div>
      </InviteShell>
    );
  }

  const sessionEmail = session.user.email.trim().toLowerCase();
  if (sessionEmail !== invite.email) {
    return (
      <InviteShell heading={t.invitePage.wrongAccountTitle}>
        <p className="text-sm text-muted-foreground">
          {t.invitePage.wrongAccountBody
            .replace("{current}", session.user.email)
            .replace("{expected}", invite.email)}
        </p>
        <InviteSummary
          orgName={invite.organization.name}
          inviterName={inviterName}
          roleLabel={roleLabel}
          labels={{
            orgLabel: t.invitePage.orgLabel,
            inviterLabel: t.invitePage.inviterLabel,
            roleLabel: t.invitePage.roleLabelLabel,
          }}
        />
      </InviteShell>
    );
  }

  // All green: authenticated + email matches + still pending.
  return (
    <InviteShell
      heading={t.invitePage.readyTitle}
      subheading={t.invitePage.readySubtitle.replace("{org}", invite.organization.name)}
    >
      <InviteSummary
        orgName={invite.organization.name}
        inviterName={inviterName}
        roleLabel={roleLabel}
        labels={{
          orgLabel: t.invitePage.orgLabel,
          inviterLabel: t.invitePage.inviterLabel,
          roleLabel: t.invitePage.roleLabelLabel,
        }}
      />
      <p className="text-xs text-muted-foreground">
        {t.invitePage.expiresAt.replace("{date}", dateFmt.format(invite.expiresAt))}
      </p>
      <AcceptInviteButton
        token={token}
        labels={{
          accept: t.invitePage.acceptCta,
          accepting: t.invitePage.accepting,
          successTitle: t.invitePage.successTitle,
          successBody: t.invitePage.successBody.replace("{org}", invite.organization.name),
          goToDashboard: t.invitePage.goToDashboard,
        }}
      />
    </InviteShell>
  );
}

function InviteShell({
  heading,
  subheading,
  children,
}: {
  heading: string;
  subheading?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{heading}</h1>
        {subheading ? <p className="text-sm text-muted-foreground">{subheading}</p> : null}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function InviteSummary({
  orgName,
  inviterName,
  roleLabel,
  labels,
}: {
  orgName: string;
  inviterName: string;
  roleLabel: string;
  labels: { orgLabel: string; inviterLabel: string; roleLabel: string };
}) {
  return (
    <dl className="divide-y rounded-md border bg-background">
      <div className="flex justify-between px-3 py-2 text-sm">
        <dt className="text-muted-foreground">{labels.orgLabel}</dt>
        <dd className="font-medium">{orgName}</dd>
      </div>
      <div className="flex justify-between px-3 py-2 text-sm">
        <dt className="text-muted-foreground">{labels.inviterLabel}</dt>
        <dd className="font-medium">{inviterName}</dd>
      </div>
      <div className="flex justify-between px-3 py-2 text-sm">
        <dt className="text-muted-foreground">{labels.roleLabel}</dt>
        <dd className="font-medium">{roleLabel}</dd>
      </div>
    </dl>
  );
}
