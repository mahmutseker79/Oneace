/**
 * @openapi-tag: /onboarding/organization
 *
 * P3-4 (audit v1.1 §5.32) — the tag above is the canonical route
 * path. docs/openapi.yaml MUST declare the same path with every
 * HTTP method this file exports. `src/lib/openapi-parity.test.ts`
 * pins the two in lockstep.
 */
import { recordAudit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getMailer } from "@/lib/mail";
import { buildWelcomeEmail } from "@/lib/mail/templates/welcome-email";
import { seedOrganization } from "@/lib/org-setup/seed";
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

  // P3.2 — Create org with an OWNER membership and a default location
  // in a single nested write so the user never lands on an empty dashboard.
  // Phase MIG-S3: set onboardingStep=2 (Step 1 is complete, Step 2 is next).
  const org = await db.organization.create({
    data: {
      name: parsed.data.name,
      slug,
      onboardingStep: 2,
      memberships: {
        create: {
          userId: session.user.id,
          role: "OWNER",
        },
      },
      warehouses: {
        create: {
          name: "Main Location",
          code: "MAIN",
          isDefault: true,
        },
      },
    },
    include: {
      warehouses: { select: { id: true }, take: 1 },
    },
  });

  // Audit the auto-created default location (fire-and-forget pattern).
  const defaultWarehouse = org.warehouses[0];
  if (defaultWarehouse) {
    await recordAudit({
      organizationId: org.id,
      actorId: session.user.id,
      action: "warehouse.created",
      entityType: "warehouse",
      entityId: defaultWarehouse.id,
      metadata: {
        name: "Main Location",
        code: "MAIN",
        isDefault: true,
        source: "onboarding",
      },
    });
  }

  // Phase L9 — Seed default org configuration (fire-and-forget, soft failure)
  // Seed failure does not block org creation.
  void seedOrganization(org.id);

  // Phase 15.4 — send welcome email (fire-and-forget, soft failure)
  void (async () => {
    try {
      const appUrl = env.NEXT_PUBLIC_APP_URL ?? "https://oneace.app";
      const mailer = getMailer();
      const email = buildWelcomeEmail({
        userName: session.user.name ?? session.user.email,
        orgName: org.name,
        appUrl,
      });
      await mailer.send({ to: session.user.email, ...email });
    } catch (err) {
      // Welcome email failure is a soft miss — user has already
      // created their org successfully. Log and continue.
      logger.warn("welcome email: send failed", {
        userId: session.user.id,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  })();

  return NextResponse.json({ organization: org }, { status: 201 });
}

// Phase MIG-S3 — PATCH handler to update onboarding state.
// Accepts { onboardingStep?: number, onboardingCompletedAt?: true }

const patchSchema = z.object({
  onboardingStep: z.number().int().min(1).max(4).optional(),
  onboardingCompletedAt: z.literal(true).optional(),
});

export async function PATCH(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  // Ensure user has an active membership
  const membership = await db.membership.findFirst({
    where: { userId: session.user.id, deactivatedAt: null },
    include: { organization: true },
  });

  if (!membership) {
    return NextResponse.json({ message: "No active membership" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { onboardingStep, onboardingCompletedAt } = parsed.data;

  const updateData: Record<string, unknown> = {};
  if (onboardingStep !== undefined) {
    updateData.onboardingStep = onboardingStep;
  }
  if (onboardingCompletedAt) {
    updateData.onboardingCompletedAt = new Date();
  }

  const updated = await db.organization.update({
    where: { id: membership.organizationId },
    data: updateData,
  });

  return NextResponse.json({ organization: updated }, { status: 200 });
}
