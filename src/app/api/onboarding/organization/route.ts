import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
// Phase 6A / P2 — narrow rate-limit surface for org create. See
// `src/lib/rate-limit.ts` for the design note on fail-open behavior.
import { rateLimit } from "@/lib/rate-limit";
import { slugify } from "@/lib/utils";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(2, "Must be at least 2 characters").max(80),
});

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  // Phase 6A / P2 — onboarding org-create is the lowest-frequency
  // write on the whole app (a user who creates more than a handful
  // of orgs an hour is almost certainly abusing the surface). 3
  // creates per user per hour is generous for legitimate multi-org
  // owners and gives an attacker nothing.
  const rate = await rateLimit(`onboarding:org-create:user:${session.user.id}`, {
    max: 3,
    windowSeconds: 3600,
  });
  if (!rate.ok) {
    const retryAfter = Math.max(1, rate.reset - Math.floor(Date.now() / 1000));
    return NextResponse.json(
      { message: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(rate.limit),
          "X-RateLimit-Remaining": String(rate.remaining),
          "X-RateLimit-Reset": String(rate.reset),
        },
      },
    );
  }

  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  // Ensure the slug is unique — retry with a random suffix on collision.
  const baseSlug = slugify(parsed.data.name) || "oneace";
  let slug = baseSlug;
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await db.organization.findUnique({ where: { slug } });
    if (!existing) break;
    slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const org = await db.organization.create({
    data: {
      name: parsed.data.name,
      slug,
      memberships: {
        create: {
          userId: session.user.id,
          role: "OWNER",
        },
      },
    },
  });

  return NextResponse.json({ organization: org }, { status: 201 });
}
