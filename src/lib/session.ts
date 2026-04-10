import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

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
 * MVP behavior: the first membership (oldest). Sprint 9 adds an org switcher.
 */
export async function requireActiveMembership() {
  const session = await requireSession();
  const membership = await db.membership.findFirst({
    where: { userId: session.user.id },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });

  if (!membership) {
    redirect("/onboarding");
  }

  return { session, membership };
}
