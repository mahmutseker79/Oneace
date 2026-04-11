"use server";

import { Prisma, Role } from "@/generated/prisma";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

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
  const { membership } = await requireActiveMembership();
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

  try {
    await db.organization.update({
      where: { id: membership.organizationId },
      data: { name: parsed.data.name, slug: parsed.data.slug },
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
