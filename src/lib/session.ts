import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

/**
 * Shape returned by `getActiveOrgPreferences`. `null` fields mean the
 * org explicitly has no override, so the i18n resolver should continue
 * to its next fallback (Accept-Language / platform default).
 */
export type ActiveOrgPreferences = {
  defaultLocale: string | null;
  defaultRegion: string | null;
};

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
 *
 * Tenancy rule (load-bearing): the Prisma client returned by `db` is
 * NOT tenant-scoped. Every server-side read of an entity that will be
 * mutated must therefore scope explicitly by
 * `{ id, organizationId: membership.organizationId }` via
 * `findFirst` / `findUnique` / `update` / `delete`. A bare
 * `findUnique({ where: { id } })` would leak across orgs. The action
 * files under `src/app/(app)/*\/actions.ts` are the enforced pattern
 * — new actions must match them.
 */
export const requireActiveMembership = cache(async () => {
  const session = await requireSession();

  const memberships = await db.membership.findMany({
    where: { userId: session.user.id, deactivatedAt: null },
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

/**
 * Lightweight read of the active organization's locale/region defaults.
 *
 * Used as a fallback layer inside `getLocale` / `getRegion` — AFTER the
 * user's own cookie (explicit user choice wins) but BEFORE the
 * `Accept-Language` header and platform defaults. The idea is that a
 * teammate joining an org inherits the org's preferred language without
 * anyone having to touch cookies.
 *
 * Deliberately does NOT require a session:
 *   - The active-org cookie is browser-scoped, so it's already "this
 *     user's org" — we don't cross-check membership here because the
 *     fallback locale is not sensitive, and every query that actually
 *     touches org data goes through `requireActiveMembership` which
 *     re-checks membership.
 *   - Fails silently on any error (unauthenticated route, DB blip,
 *     deleted org) so the i18n resolver can't crash the marketing
 *     shell or login page.
 *
 * Wrapped in React `cache()` so a render that calls both `getLocale`
 * and `getRegion` only hits the DB once.
 */
export const getActiveOrgPreferences = cache(async (): Promise<ActiveOrgPreferences | null> => {
  try {
    const cookieStore = await cookies();
    const activeOrgId = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;
    if (!activeOrgId) return null;

    const org = await db.organization.findUnique({
      where: { id: activeOrgId },
      select: { defaultLocale: true, defaultRegion: true },
    });
    if (!org) return null;
    return { defaultLocale: org.defaultLocale, defaultRegion: org.defaultRegion };
  } catch {
    // Any failure (no cookie context, deleted org, DB unreachable) just
    // means "no org-level override" — fall through to the next layer.
    return null;
  }
});
