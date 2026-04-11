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
import { requireActiveMembership } from "@/lib/session";
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
