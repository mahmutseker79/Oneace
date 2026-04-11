"use server";

import { Role } from "@/generated/prisma";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { getMessages, getRegion } from "@/lib/i18n";
import {
  buildInvitationUrl,
  classifyInvitation,
  defaultInvitationExpiry,
  generateInvitationToken,
} from "@/lib/invitations";
import { getMailer } from "@/lib/mail";
import { buildInvitationEmail } from "@/lib/mail/templates/invitation-email";
import { requireActiveMembership, requireSession } from "@/lib/session";
import { inviteMemberSchema, updateMemberRoleSchema } from "@/lib/validation/membership";

export type UsersActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * Sprint 20: successful `inviteMemberAction` returns the invitation URL
 * so the admin can copy it.
 *
 * Sprint 33: the action now also attempts email delivery via the
 * configured `Mailer` (Resend in prod, ConsoleMailer in dev). The
 * result carries an `emailDelivered` flag so the UI can surface
 * either "Email sent to x" (happy path) or "Email not configured —
 * copy the link below" (dev / Resend failure). Delivery failure is
 * deliberately a soft miss: the invite row is still valid, the
 * admin can still copy the link, so we don't want a DNS blip to
 * block team onboarding.
 */
export type InviteMemberResult =
  | {
      ok: true;
      invitationId: string;
      inviteUrl: string;
      expiresAt: Date;
      emailDelivered: boolean;
    }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export type AcceptInvitationResult =
  | { ok: true; organizationId: string }
  | {
      ok: false;
      error: string;
      reason: "expired" | "revoked" | "already" | "wrong_email" | "other";
    };

const ADMIN_ROLES: readonly Role[] = [Role.OWNER, Role.ADMIN];

function canManageTeam(role: Role): boolean {
  return ADMIN_ROLES.includes(role);
}

async function isLastOwner(organizationId: string, membershipId: string): Promise<boolean> {
  const target = await db.membership.findUnique({
    where: { id: membershipId },
    select: { role: true, organizationId: true },
  });
  if (!target || target.organizationId !== organizationId) return false;
  if (target.role !== Role.OWNER) return false;
  const ownerCount = await db.membership.count({
    where: { organizationId, role: Role.OWNER },
  });
  return ownerCount <= 1;
}

/**
 * Sprint 20 rewrite. Instead of requiring the invitee's `User` row to
 * already exist, we now create an `Invitation` row with a random
 * capability token. The admin receives a URL they can copy/paste into
 * whatever channel they already use (email, Slack, WhatsApp). When
 * the invitee signs in with a matching email and visits
 * `/invite/{token}`, `acceptInvitationAction` creates the membership.
 *
 * Validation gates:
 *   - caller must be OWNER/ADMIN in the active org (unchanged)
 *   - only an OWNER can invite another OWNER (unchanged)
 *   - the invitee cannot already be a member of this org (by User.email)
 *   - there cannot already be a pending (non-accepted, non-revoked,
 *     non-expired) invitation for the same org+email
 */
export async function inviteMemberAction(formData: FormData): Promise<InviteMemberResult> {
  const { membership, session } = await requireActiveMembership();
  const t = await getMessages();

  if (!canManageTeam(membership.role)) {
    return { ok: false, error: t.users.invite.errors.forbidden };
  }

  const parsed = inviteMemberSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: t.users.invite.errors.createFailed,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const { email, role } = parsed.data;

  // Only OWNER can mint another OWNER.
  if (role === Role.OWNER && membership.role !== Role.OWNER) {
    return { ok: false, error: t.users.invite.errors.forbidden };
  }

  // If the invitee is already in this org, short-circuit with a
  // helpful message instead of silently creating a dead invite.
  const existingMembership = await db.membership.findFirst({
    where: {
      organizationId: membership.organizationId,
      user: { email },
    },
    select: { id: true },
  });
  if (existingMembership) {
    return {
      ok: false,
      error: t.users.invite.errors.alreadyMember,
      fieldErrors: { email: [t.users.invite.errors.alreadyMember] },
    };
  }

  // If there's already a live (pending) invite for this org+email,
  // refuse rather than spawning a duplicate. The admin can revoke
  // the old one first if they want to reissue with a different role.
  const existingLive = await db.invitation.findFirst({
    where: {
      organizationId: membership.organizationId,
      email,
      acceptedAt: null,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });
  if (existingLive) {
    return {
      ok: false,
      error: t.users.invite.errors.alreadyInvited,
      fieldErrors: { email: [t.users.invite.errors.alreadyInvited] },
    };
  }

  const token = generateInvitationToken();
  const expiresAt = defaultInvitationExpiry();

  let created: { id: string };
  try {
    created = await db.invitation.create({
      data: {
        organizationId: membership.organizationId,
        email,
        role,
        token,
        invitedById: session.user.id,
        expiresAt,
      },
      select: { id: true },
    });
  } catch {
    return { ok: false, error: t.users.invite.errors.createFailed };
  }

  const inviteUrl = buildInvitationUrl(token);

  // Sprint 33: fire the invitation email. Any failure here is a soft
  // miss — the invite row is live, the admin gets the copyable URL
  // back, and the UI shows the "not delivered" variant so the admin
  // knows to ping the invitee through another channel.
  const emailDelivered = await sendInvitationEmailSafely({
    to: email,
    organizationName: membership.organization.name,
    inviterName: session.user.name ?? session.user.email,
    role,
    inviteUrl,
    expiresAt,
  });

  revalidatePath("/users");
  return {
    ok: true,
    invitationId: created.id,
    inviteUrl,
    expiresAt,
    emailDelivered,
  };
}

/**
 * Sprint 33 helper. Renders the invitation email template and ships it
 * to whichever mailer is configured. Returns `true` only on a
 * confirmed provider success; logs + swallows any other outcome.
 *
 * Kept as a sibling function rather than inlined so the happy path in
 * `inviteMemberAction` stays readable, and so we can swap in a stub
 * during tests without touching the action body.
 */
async function sendInvitationEmailSafely(params: {
  to: string;
  organizationName: string;
  inviterName: string;
  role: Role;
  inviteUrl: string;
  expiresAt: Date;
}): Promise<boolean> {
  try {
    const t = await getMessages();
    const region = await getRegion();
    const dateFmt = new Intl.DateTimeFormat(region.numberLocale, {
      dateStyle: "medium",
      timeStyle: "short",
    });
    const roleLabel = t.users.roles[params.role];

    const rendered = buildInvitationEmail({
      to: params.to,
      organizationName: params.organizationName,
      inviterName: params.inviterName,
      role: params.role,
      inviteUrl: params.inviteUrl,
      expiresAt: params.expiresAt,
      labels: t.mail.invitation,
      dateFmt,
      roleLabel,
    });

    const result = await getMailer().send({
      to: params.to,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
    });

    if (!result.ok) {
      // eslint-disable-next-line no-console
      console.warn(`[invite] mail delivery failed: ${result.error}`);
      return false;
    }
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[invite] mail delivery threw: ${err instanceof Error ? err.message : "unknown"}`);
    return false;
  }
}

/**
 * Sprint 20: revoke a pending invitation. Leaves the row around
 * (stamped `revokedAt`) so the pending-invitations table can still
 * show "revoked by X at Y" as an audit trail.
 */
export async function revokeInvitationAction(invitationId: string): Promise<UsersActionResult> {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!canManageTeam(membership.role)) {
    return { ok: false, error: t.users.invite.errors.forbidden };
  }

  const invite = await db.invitation.findUnique({
    where: { id: invitationId },
    select: {
      id: true,
      organizationId: true,
      acceptedAt: true,
      revokedAt: true,
    },
  });
  if (!invite || invite.organizationId !== membership.organizationId) {
    return { ok: false, error: t.users.errors.notFound };
  }
  if (invite.acceptedAt) {
    return { ok: false, error: t.users.invitations.errors.alreadyAccepted };
  }
  if (invite.revokedAt) {
    // Idempotent: pretend it worked.
    return { ok: true };
  }

  try {
    await db.invitation.update({
      where: { id: invitationId },
      data: { revokedAt: new Date() },
    });
    revalidatePath("/users");
    return { ok: true };
  } catch {
    return { ok: false, error: t.users.errors.updateFailed };
  }
}

/**
 * Sprint 20: accept an invitation from the `/invite/[token]` page.
 * The authenticated user's email must match the invitee email on the
 * row — this is the load-bearing guard that prevents a leaked URL
 * being accepted by a random third party.
 */
export async function acceptInvitationAction(token: string): Promise<AcceptInvitationResult> {
  const session = await requireSession();
  const t = await getMessages();

  const invite = await db.invitation.findUnique({
    where: { token },
    select: {
      id: true,
      organizationId: true,
      email: true,
      role: true,
      acceptedAt: true,
      revokedAt: true,
      expiresAt: true,
    },
  });
  if (!invite) {
    return { ok: false, error: t.invitePage.errors.notFound, reason: "other" };
  }

  const status = classifyInvitation(invite);
  if (status === "accepted") {
    return { ok: false, error: t.invitePage.errors.alreadyAccepted, reason: "already" };
  }
  if (status === "revoked") {
    return { ok: false, error: t.invitePage.errors.revoked, reason: "revoked" };
  }
  if (status === "expired") {
    return { ok: false, error: t.invitePage.errors.expired, reason: "expired" };
  }

  // Email match. `session.user.email` is already the canonical address
  // Better Auth stamped on sign-in.
  const sessionEmail = session.user.email.trim().toLowerCase();
  if (sessionEmail !== invite.email) {
    return { ok: false, error: t.invitePage.errors.wrongEmail, reason: "wrong_email" };
  }

  // If they're already a member of this org, mark the invite accepted
  // anyway and treat this as a success — no need to surface an error.
  const existing = await db.membership.findUnique({
    where: {
      userId_organizationId: {
        userId: session.user.id,
        organizationId: invite.organizationId,
      },
    },
    select: { id: true },
  });

  try {
    if (!existing) {
      await db.$transaction([
        db.membership.create({
          data: {
            userId: session.user.id,
            organizationId: invite.organizationId,
            role: invite.role,
          },
        }),
        db.invitation.update({
          where: { id: invite.id },
          data: { acceptedAt: new Date(), acceptedById: session.user.id },
        }),
      ]);
    } else {
      // Already a member — still stamp the invite so it disappears
      // from the pending list.
      await db.invitation.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date(), acceptedById: session.user.id },
      });
    }
    revalidatePath("/users");
    revalidatePath("/", "layout");
    return { ok: true, organizationId: invite.organizationId };
  } catch {
    return { ok: false, error: t.invitePage.errors.acceptFailed, reason: "other" };
  }
}

export async function updateMemberRoleAction(
  membershipId: string,
  rawRole: string,
): Promise<UsersActionResult> {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!canManageTeam(membership.role)) {
    return { ok: false, error: t.users.errors.forbidden };
  }

  const parsed = updateMemberRoleSchema.safeParse({ role: rawRole });
  if (!parsed.success) {
    return { ok: false, error: t.users.errors.updateFailed };
  }
  const nextRole = parsed.data.role;

  const target = await db.membership.findUnique({
    where: { id: membershipId },
    select: { id: true, role: true, organizationId: true },
  });
  if (!target || target.organizationId !== membership.organizationId) {
    return { ok: false, error: t.users.errors.notFound };
  }

  // Demoting the last owner is forbidden.
  if (target.role === Role.OWNER && nextRole !== Role.OWNER) {
    if (await isLastOwner(membership.organizationId, target.id)) {
      return { ok: false, error: t.users.errors.lastOwner };
    }
  }

  // Only an OWNER can promote someone to OWNER.
  if (nextRole === Role.OWNER && membership.role !== Role.OWNER) {
    return { ok: false, error: t.users.errors.forbidden };
  }

  try {
    await db.membership.update({
      where: { id: membershipId },
      data: { role: nextRole },
    });
    revalidatePath("/users");
    return { ok: true };
  } catch {
    return { ok: false, error: t.users.errors.updateFailed };
  }
}

export async function removeMemberAction(membershipId: string): Promise<UsersActionResult> {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!canManageTeam(membership.role)) {
    return { ok: false, error: t.users.errors.forbidden };
  }

  if (membershipId === membership.id) {
    return { ok: false, error: t.users.errors.cannotRemoveSelf };
  }

  const target = await db.membership.findUnique({
    where: { id: membershipId },
    select: { id: true, role: true, organizationId: true },
  });
  if (!target || target.organizationId !== membership.organizationId) {
    return { ok: false, error: t.users.errors.notFound };
  }

  if (await isLastOwner(membership.organizationId, target.id)) {
    return { ok: false, error: t.users.errors.lastOwner };
  }

  try {
    await db.membership.delete({ where: { id: membershipId } });
    revalidatePath("/users");
    return { ok: true };
  } catch {
    return { ok: false, error: t.users.errors.removeFailed };
  }
}
