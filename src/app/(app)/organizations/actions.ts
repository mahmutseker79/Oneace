"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { ACTIVE_ORG_COOKIE, requireSession } from "@/lib/session";
import { slugify } from "@/lib/utils";

export type SwitchOrgResult = { ok: true; organizationId: string } | { ok: false; error: string };

export type CreateOrgResult = { ok: true; organizationId: string } | { ok: false; error: string };

/**
 * Write the `oneace-active-org` cookie and revalidate the root layout so
 * every server component re-reads `requireActiveMembership()` on the next
 * navigation. We deliberately do NOT take the selected org on faith —
 * every switch round-trips to the DB to confirm the caller still has a
 * membership in the target org (otherwise a stale cookie from a just-
 * removed user would give them a one-frame view of data they no longer
 * have access to).
 *
 * Security note: this action is the one place that trusts caller-supplied
 * organizationId, and it validates it against the caller's own membership
 * list. Everything downstream reads `membership.organizationId` from
 * `requireActiveMembership()`, which re-derives the active org on every
 * request, so the cookie is never the ultimate authority.
 */
export async function switchOrganizationAction(organizationId: string): Promise<SwitchOrgResult> {
  const session = await requireSession();
  const t = await getMessages();

  if (typeof organizationId !== "string" || organizationId.length === 0) {
    return { ok: false, error: t.organizations.errors.invalidId };
  }

  const membership = await db.membership.findFirst({
    where: { userId: session.user.id, organizationId },
    select: { id: true, organizationId: true },
  });

  if (!membership) {
    return { ok: false, error: t.organizations.errors.notAMember };
  }

  const store = await cookies();
  store.set(ACTIVE_ORG_COOKIE, membership.organizationId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  // Revalidate the whole layout so sidebar, header, and every server
  // page re-read the new active org on the next navigation.
  revalidatePath("/", "layout");

  return { ok: true, organizationId: membership.organizationId };
}

/**
 * Create a new organization owned by the current user and atomically
 * flip the active-org cookie to point at it. The caller is always
 * granted OWNER on the new org via a nested write — there's no path
 * where the organization exists without a membership for its creator.
 *
 * We use a short slugify + up-to-5-random-suffix retry loop to handle
 * slug collisions. This mirrors the logic in
 * `src/app/api/onboarding/organization/route.ts` (first-org creation),
 * but lives here as a server action so the post-create flow can run
 * inside a `useTransition` and the cookie flip is guaranteed to
 * happen in the same request that created the org. The first-org
 * onboarding route is deliberately left untouched — it predates
 * multi-tenancy and is exercised by Better Auth's signup handler.
 *
 * Security note: same story as switchOrganizationAction — the new
 * membership is written inside the same DB round-trip that writes
 * the org, so there is no intermediate state where a user could
 * point the active-org cookie at an org they don't own.
 */
export async function createOrganizationAction(rawName: string): Promise<CreateOrgResult> {
  const session = await requireSession();
  const t = await getMessages();

  const name = typeof rawName === "string" ? rawName.trim() : "";
  if (name.length < 2) {
    return { ok: false, error: t.organizations.errors.nameTooShort };
  }
  if (name.length > 80) {
    return { ok: false, error: t.organizations.errors.nameTooLong };
  }

  // Resolve a unique slug. Retry a few times with a random suffix on
  // collision; fall back to the "oneace" base if slugify returns empty
  // (e.g. a name that's all non-latin punctuation).
  const baseSlug = slugify(name) || "oneace";
  let slug = baseSlug;
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await db.organization.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!existing) break;
    slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
  }

  let created: { id: string } | null = null;
  try {
    created = await db.organization.create({
      data: {
        name,
        slug,
        memberships: {
          create: { userId: session.user.id, role: "OWNER" },
        },
      },
      select: { id: true },
    });
  } catch {
    return { ok: false, error: t.organizations.errors.createFailed };
  }

  const store = await cookies();
  store.set(ACTIVE_ORG_COOKIE, created.id, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  // Revalidate the whole layout so sidebar, header, and every server
  // page re-read the new active org on the next navigation.
  revalidatePath("/", "layout");

  await recordAudit({
    organizationId: created.id,
    actorId: session.user.id,
    action: "organization.updated",
    entityType: "organization",
    entityId: created.id,
    metadata: { name },
  });

  return { ok: true, organizationId: created.id };
}
