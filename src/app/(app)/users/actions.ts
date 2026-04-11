"use server";

import { Prisma, Role } from "@/generated/prisma";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";
import { inviteMemberSchema, updateMemberRoleSchema } from "@/lib/validation/membership";

export type UsersActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

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

export async function inviteMemberAction(formData: FormData): Promise<UsersActionResult> {
  const { membership } = await requireActiveMembership();
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

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) {
    return {
      ok: false,
      error: t.users.invite.errors.userNotFound,
      fieldErrors: { email: [t.users.invite.errors.userNotFound] },
    };
  }

  try {
    const created = await db.membership.create({
      data: {
        userId: user.id,
        organizationId: membership.organizationId,
        role,
      },
      select: { id: true },
    });
    revalidatePath("/users");
    return { ok: true, id: created.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        ok: false,
        error: t.users.invite.errors.alreadyMember,
        fieldErrors: { email: [t.users.invite.errors.alreadyMember] },
      };
    }
    return { ok: false, error: t.users.invite.errors.createFailed };
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
