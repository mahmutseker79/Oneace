// v1.2 P2 §5.39 — Admin session revocation UI.
//
// This page renders the active Better-Auth sessions for the signed-in
// user and lets them revoke any session that is not the one driving
// the current render. "Revoke all other sessions" is the single-click
// stolen-laptop recovery path.
//
// The page is a server component so the initial render ships the
// session list with the HTML — no client fetch flash on first paint.
// Revokes themselves go through the client component to keep
// optimistic updates straightforward.

import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import type { Metadata } from "next";
import { SessionsClient } from "./sessions-client";

export const metadata: Metadata = {
  title: "Active sessions",
};

export default async function SessionsPage() {
  const session = await requireSession();
  const currentSessionId = session.session.id;

  const rows = await db.session.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      userAgent: true,
      ipAddress: true,
      createdAt: true,
      updatedAt: true,
      expiresAt: true,
    },
  });

  // Serialise Date → ISO string so client props stay JSON-safe. The
  // UI formats via `Intl.DateTimeFormat` on the client so the user's
  // locale wins.
  const sessions = rows.map((row) => ({
    id: row.id,
    userAgent: row.userAgent,
    ipAddress: row.ipAddress,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    current: row.id === currentSessionId,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Active sessions"
        description="Review devices signed in to your account and revoke any you don't recognise."
        breadcrumb={[
          { label: "Settings", href: "/settings" },
          { label: "Security", href: "/settings/security" },
          { label: "Sessions", href: "#" },
        ]}
        backHref="/settings/security"
      />

      <div className="max-w-3xl">
        <SessionsClient sessions={sessions} />
      </div>
    </div>
  );
}
