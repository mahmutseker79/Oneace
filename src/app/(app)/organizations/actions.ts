"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { ACTIVE_ORG_COOKIE, requireSession } from "@/lib/session";

export type SwitchOrgResult = { ok: true; organizationId: string } | { ok: false; error: string };

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
