"use server";

import { Prisma, Role } from "@/generated/prisma";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import {
  LOCALE_COOKIE,
  REGION_COOKIE,
  SUPPORTED_LOCALES,
  SUPPORTED_REGIONS,
} from "@/lib/i18n/config";
import { ACTIVE_ORG_COOKIE, requireActiveMembership } from "@/lib/session";
import { organizationProfileSchema } from "@/lib/validation/organization";

export type SettingsActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

const ADMIN_ROLES: readonly Role[] = [Role.OWNER, Role.ADMIN];

function isAdmin(role: Role): boolean {
  return ADMIN_ROLES.includes(role);
}

export async function updateOrganizationProfileAction(
  formData: FormData,
): Promise<SettingsActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!isAdmin(membership.role)) {
    return { ok: false, error: t.settings.organization.errors.forbidden };
  }

  const parsed = organizationProfileSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: t.settings.organization.errors.updateFailed,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  // Snapshot the before-values so the audit entry can carry a minimal
  // before/after diff without a second round-trip. We only record the
  // fields the user actually changed to keep the metadata payload small.
  const before = {
    name: membership.organization.name,
    slug: membership.organization.slug,
  };

  try {
    await db.organization.update({
      where: { id: membership.organizationId },
      data: { name: parsed.data.name, slug: parsed.data.slug },
    });
    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "organization.updated",
      entityType: "organization",
      entityId: membership.organizationId,
      metadata: {
        before,
        after: { name: parsed.data.name, slug: parsed.data.slug },
      },
    });
    revalidatePath("/settings");
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        ok: false,
        error: t.settings.organization.errors.slugExists,
        fieldErrors: { slug: [t.settings.organization.errors.slugExists] },
      };
    }
    return { ok: false, error: t.settings.organization.errors.updateFailed };
  }
}

export async function setLocaleAction(locale: string): Promise<SettingsActionResult> {
  // Any authenticated member can pick their own interface language.
  await requireActiveMembership();
  const t = await getMessages();

  if (!(SUPPORTED_LOCALES as readonly string[]).includes(locale)) {
    return { ok: false, error: t.settings.organization.errors.updateFailed };
  }

  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setRegionAction(regionCode: string): Promise<SettingsActionResult> {
  await requireActiveMembership();
  const t = await getMessages();

  const known = SUPPORTED_REGIONS.some((r) => r.code === regionCode);
  if (!known) {
    return { ok: false, error: t.settings.organization.errors.updateFailed };
  }

  const store = await cookies();
  store.set(REGION_COOKIE, regionCode, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Sprint 19: persist the active organization's default locale/region.
 *
 * This is the org-level fallback layer that `getLocale` / `getRegion`
 * consult after the user's own cookie and before the Accept-Language
 * header. An empty string means "clear the override" — the resolver
 * will then fall through to Accept-Language / platform default.
 *
 * Gated on OWNER/ADMIN. Any non-admin attempt short-circuits before
 * we touch the DB. Both values are validated against the hard-coded
 * SUPPORTED_LOCALES / SUPPORTED_REGIONS catalog so a crafted request
 * body can't poison the resolver with a locale we don't ship messages
 * for.
 */
export async function updateOrgDefaultsAction(formData: FormData): Promise<SettingsActionResult> {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!isAdmin(membership.role)) {
    return { ok: false, error: t.settings.orgDefaults.errors.forbidden };
  }

  const rawLocale = (formData.get("defaultLocale") ?? "").toString().trim();
  const rawRegion = (formData.get("defaultRegion") ?? "").toString().trim();

  let defaultLocale: string | null;
  if (rawLocale.length === 0) {
    defaultLocale = null;
  } else if ((SUPPORTED_LOCALES as readonly string[]).includes(rawLocale)) {
    defaultLocale = rawLocale;
  } else {
    return {
      ok: false,
      error: t.settings.orgDefaults.errors.invalidLocale,
      fieldErrors: { defaultLocale: [t.settings.orgDefaults.errors.invalidLocale] },
    };
  }

  let defaultRegion: string | null;
  if (rawRegion.length === 0) {
    defaultRegion = null;
  } else if (SUPPORTED_REGIONS.some((r) => r.code === rawRegion)) {
    defaultRegion = rawRegion;
  } else {
    return {
      ok: false,
      error: t.settings.orgDefaults.errors.invalidRegion,
      fieldErrors: { defaultRegion: [t.settings.orgDefaults.errors.invalidRegion] },
    };
  }

  try {
    await db.organization.update({
      where: { id: membership.organizationId },
      data: { defaultLocale, defaultRegion },
    });
    revalidatePath("/settings");
    // Layout revalidate so the header + every server component picks
    // up the new fallback on the next navigation, not the next hard
    // reload.
    revalidatePath("/", "layout");
    return { ok: true };
  } catch {
    return { ok: false, error: t.settings.orgDefaults.errors.updateFailed };
  }
}

/**
 * Result of {@link deleteOrganizationAction}.
 *
 * On success, `nextPath` tells the client where to navigate after the
 * delete completes — either the root (which will resolve to another
 * org they're a member of) or `/organizations/create` if the user
 * deleted their only organization.
 */
export type DeleteOrganizationResult =
  | { ok: true; nextPath: string }
  | {
      ok: false;
      error: string;
      reason: "forbidden" | "mismatch" | "deleteFailed";
    };

/**
 * Sprint 21: delete the current active organization.
 *
 * Security model:
 *   - OWNER only (not ADMIN). Deleting an org is irreversible and
 *     destroys every user's data in that tenant, so it's scoped
 *     tighter than the other admin operations.
 *   - Never takes the organization id from the client. The action
 *     only deletes the *currently active* org from the server-side
 *     `requireActiveMembership` — this prevents a CSRF-style attack
 *     where a crafted form tricks an OWNER into deleting a different
 *     tenant they happen to own.
 *   - Typed-confirmation guard: the client must echo back the org's
 *     slug exactly (including case). This isn't cryptographic — it's
 *     UX protection against fat-finger clicks on a destructive button.
 *
 * Cascade model:
 *   Every org-owned model (Warehouse, Category, Item, StockLevel,
 *   StockMovement, StockCount, CountSnapshot, CountEntry, Supplier,
 *   PurchaseOrder, PurchaseOrderLine, Membership, Invitation) has
 *   `onDelete: Cascade` on its `organization` relation, so a single
 *   `db.organization.delete` wipes everything in one transaction.
 *   Better-Auth tables (User, Session, Account, Verification) are
 *   NOT org-owned and survive — the deleting user stays signed in.
 *
 * Post-delete housekeeping:
 *   - If the user has other memberships, the `oneace-active-org`
 *     cookie is updated to point at the oldest remaining one so the
 *     next render lands in a valid tenant; the client is told to
 *     navigate to `/`.
 *   - If this was the user's only org, the cookie is cleared and the
 *     client is sent to `/organizations/create` so they can bootstrap
 *     a new tenant instead of getting bounced to `/onboarding`.
 */
export async function deleteOrganizationAction(
  confirmation: string,
): Promise<DeleteOrganizationResult> {
  // NOTE (Sprint 36): we deliberately do NOT write an audit event here.
  // AuditEvent.organizationId is a required FK with `onDelete: Cascade`,
  // so any row we write would be wiped in the same transaction as the
  // organization delete. Organization-deletion observability belongs in
  // the server-side structured logger (Sprint 37) instead.
  const { membership, memberships } = await requireActiveMembership();
  const t = await getMessages();

  if (membership.role !== Role.OWNER) {
    return {
      ok: false,
      error: t.settings.dangerZone.errors.forbidden,
      reason: "forbidden",
    };
  }

  // The typed-confirmation must match the org's slug verbatim. Slug
  // is used instead of the display name because it has no spaces or
  // diacritics — fewer ways to get the check wrong on a phone.
  if (confirmation.trim() !== membership.organization.slug) {
    return {
      ok: false,
      error: t.settings.dangerZone.errors.mismatch,
      reason: "mismatch",
    };
  }

  const targetOrgId = membership.organizationId;
  const remaining = memberships.filter((m) => m.organizationId !== targetOrgId);

  try {
    await db.organization.delete({ where: { id: targetOrgId } });
  } catch {
    return {
      ok: false,
      error: t.settings.dangerZone.errors.deleteFailed,
      reason: "deleteFailed",
    };
  }

  const store = await cookies();
  if (remaining.length > 0) {
    // Pin the next active org explicitly so the next render doesn't
    // see a stale cookie. `requireActiveMembership` sorts ascending
    // by createdAt, so the "oldest remaining" is the natural default.
    // biome-ignore lint/style/noNonNullAssertion: remaining.length > 0 is checked above
    const next = remaining[0]!;
    store.set(ACTIVE_ORG_COOKIE, next.organizationId, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  } else {
    store.delete(ACTIVE_ORG_COOKIE);
  }

  // Revalidate the layout so the header org switcher drops the
  // deleted entry on the next navigation.
  revalidatePath("/", "layout");

  return {
    ok: true,
    nextPath: remaining.length > 0 ? "/" : "/organizations/create",
  };
}

/**
 * Result of {@link transferOrganizationAction}.
 *
 * On success, `targetName` lets the caller show a toast like
 * "Ownership transferred to Alice" without a second lookup. `reason`
 * is a coarse classifier so the UI can swap in field-level guidance
 * for the typical mistakes (wrong confirmation slug, self target,
 * caller no longer OWNER).
 */
export type TransferOrganizationResult =
  | { ok: true; targetName: string }
  | {
      ok: false;
      error: string;
      reason: "forbidden" | "selfTarget" | "notFound" | "mismatch" | "transferFailed";
    };

/**
 * Sprint 32: transfer organization ownership to another member.
 *
 * This is the missing third leg of the multi-tenancy story after
 * Sprint 11 (switcher) and Sprint 21 (delete). It's a dedicated
 * server action rather than a reuse of `updateMemberRoleAction`
 * because it's **atomic** (no intermediate two-owner state leaks
 * into audit logs, reports, or a concurrent request), it has a
 * different security envelope (OWNER only, not ADMIN), it requires
 * a typed-confirmation guard (matching the danger-zone pattern),
 * and it demotes the caller in the same round-trip so the operation
 * is idempotent from the client's perspective.
 *
 * Security model:
 *   - OWNER only. ADMIN can already change other members' roles,
 *     but handing over the keys is owner-scoped. This matches how
 *     "delete org" and "invite OWNER" are already gated.
 *   - Never takes the organization id from the client. The caller's
 *     active membership is the only anchor — every lookup is pinned
 *     to `membership.organizationId` from `requireActiveMembership`.
 *     This prevents a CSRF-style attack where a form tricks an OWNER
 *     into promoting someone in a different tenant they happen to
 *     own.
 *   - Typed-confirmation guard: the client must echo back the org's
 *     slug exactly. Same UX protection the delete flow uses —
 *     slug has no spaces or diacritics, so fat-finger safety is
 *     clean on mobile.
 *   - Cannot transfer to self. Even though the atomic transaction
 *     would make this a no-op with extra demotion pain, blocking it
 *     up front gives a cleaner error message than watching the
 *     caller demote themselves to ADMIN while targeting their own
 *     id.
 *
 * Atomic transaction:
 *   The target's role is upserted to OWNER, and in the same tx the
 *   caller's role is set to ADMIN. We deliberately do NOT `set`
 *   the caller to MEMBER — dropping from OWNER to MEMBER is a
 *   bigger role delta than most hand-offs want (e.g. a founder
 *   transferring to a new CEO but staying operationally involved).
 *   A later "leave organization" flow can handle the full exit
 *   path if needed.
 *
 *   Because target and caller are updated inside a single
 *   `$transaction`, there is no window where the org has zero
 *   owners (bad) or where two requests could race to demote the
 *   only OWNER. If target was already OWNER (a step-down scenario
 *   where two owners exist and the caller is bowing out), the
 *   target update is effectively a no-op and the caller still
 *   demotes cleanly — we don't need a special branch.
 *
 * Post-transfer housekeeping:
 *   - The active-org cookie is unchanged. The caller still belongs
 *     to the same org, just as ADMIN now; `requireActiveMembership`
 *     picks up the new role on the next navigation.
 *   - Revalidates both `/settings` (so the transfer card disappears
 *     from the caller's view) and `/users` (so the member-table
 *     role badges refresh). Layout revalidate too, because the
 *     header may show an "Owner" chip or similar on future sprints.
 */
export async function transferOrganizationAction(
  targetMembershipId: string,
  confirmation: string,
): Promise<TransferOrganizationResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (membership.role !== Role.OWNER) {
    return {
      ok: false,
      error: t.settings.transferOwnership.errors.forbidden,
      reason: "forbidden",
    };
  }

  if (typeof targetMembershipId !== "string" || targetMembershipId.length === 0) {
    return {
      ok: false,
      error: t.settings.transferOwnership.errors.notFound,
      reason: "notFound",
    };
  }

  if (targetMembershipId === membership.id) {
    return {
      ok: false,
      error: t.settings.transferOwnership.errors.selfTarget,
      reason: "selfTarget",
    };
  }

  if (confirmation.trim() !== membership.organization.slug) {
    return {
      ok: false,
      error: t.settings.transferOwnership.errors.mismatch,
      reason: "mismatch",
    };
  }

  const target = await db.membership.findUnique({
    where: { id: targetMembershipId },
    select: {
      id: true,
      organizationId: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });

  if (!target || target.organizationId !== membership.organizationId) {
    return {
      ok: false,
      error: t.settings.transferOwnership.errors.notFound,
      reason: "notFound",
    };
  }

  try {
    await db.$transaction([
      db.membership.update({
        where: { id: target.id },
        data: { role: Role.OWNER },
      }),
      db.membership.update({
        where: { id: membership.id },
        data: { role: Role.ADMIN },
      }),
    ]);
  } catch {
    return {
      ok: false,
      error: t.settings.transferOwnership.errors.transferFailed,
      reason: "transferFailed",
    };
  }

  await recordAudit({
    organizationId: membership.organizationId,
    actorId: session.user.id,
    action: "organization.transferred",
    entityType: "organization",
    entityId: membership.organizationId,
    metadata: {
      fromUserId: session.user.id,
      toUserId: target.user.id,
      toUserEmail: target.user.email,
      toMembershipId: target.id,
    },
  });

  // Revalidate the layout so any future OWNER-gated surfaces pick
  // up the caller's new ADMIN role on the next navigation, and
  // refresh the users table so the role badges flip immediately.
  revalidatePath("/settings");
  revalidatePath("/users");
  revalidatePath("/", "layout");

  return {
    ok: true,
    targetName: target.user.name ?? target.user.email,
  };
}
