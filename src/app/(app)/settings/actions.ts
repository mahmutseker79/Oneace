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
