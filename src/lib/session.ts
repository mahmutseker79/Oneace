import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

/**
 * Cookie that stores the user's currently-selected organization id.
 * When absent or pointing at a deleted/non-member org, we fall back to
 * the oldest membership (the classic Sprint 0 behavior). Exported so the
 * `switchOrganizationAction` can write it with a matching name.
 */
export const ACTIVE_ORG_COOKIE = "oneace-active-org";

/**
 * Returns the current session for Server Components.
 * Wrapped in React `cache` so it only runs once per request.
 */
export const getCurrentSession = cache(async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session;
});

/**
 * Guard for authenticated routes. Redirects to /login if there is no session.
 */
export async function requireSession() {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

/**
 * Resolves the user's active organization membership.
 *
 * Priority:
 *   1. `oneace-active-org` cookie, if it still points at a valid membership
 *   2. Oldest membership (the MVP default from Sprint 0)
 *
 * Also returns the full list of memberships so the header switcher can
 * render its dropdown without issuing a second query. Wrapped in React
 * `cache` — the app layout and the page both call this, and we'd rather
 * hit the DB once per request.
 */
export const requireActiveMembership = cache(async () => {
  const session = await requireSession();

  const memberships = await db.membership.findMany({
    where: { userId: session.user.id },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });

  if (memberships.length === 0) {
    redirect("/onboarding");
  }

  const cookieStore = await cookies();
  const activeOrgId = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;
  const fromCookie = activeOrgId
    ? memberships.find((m) => m.organizationId === activeOrgId)
    : undefined;
  // biome-ignore lint/style/noNonNullAssertion: memberships.length > 0 is guaranteed by the redirect above
  const membership = fromCookie ?? memberships[0]!;

  return { session, membership, memberships };
});
