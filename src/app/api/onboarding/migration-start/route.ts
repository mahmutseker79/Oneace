/**
 * @openapi-tag: /onboarding/migration-start
 *
 * P3-4 (audit v1.1 §5.32) — the tag above is the canonical route
 * path. docs/openapi.yaml MUST declare the same path with every
 * HTTP method this file exports. `src/lib/openapi-parity.test.ts`
 * pins the two in lockstep.
 */
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

// Phase MIG-S3 — Start a migration job from onboarding wizard.
// Creates a MigrationJob, sets Organization.migrationSourceHint, advances onboardingStep to 4.

const MigrationSourceEnum = z.enum([
  "SORTLY",
  "INFLOW",
  "ODOO",
  "ZOHO_INVENTORY",
  "FISHBOWL",
  "CIN7",
  "SOS_INVENTORY",
  "KATANA",
  "LIGHTSPEED",
  "QUICKBOOKS_COMMERCE",
  "DEAR_SYSTEMS",
  "GENERIC_CSV",
]);

const schema = z.object({
  source: MigrationSourceEnum,
});

export async function POST(request: Request) {
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
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { source } = parsed.data;

  // Create MigrationJob
  const job = await db.migrationJob.create({
    data: {
      organizationId: membership.organizationId,
      sourcePlatform: source,
      createdByUserId: session.user.id,
      notes: "Started from onboarding wizard",
      status: "PENDING",
    },
  });

  // Update Organization: set migrationSourceHint and advance onboardingStep to 4
  await db.organization.update({
    where: { id: membership.organizationId },
    data: {
      migrationSourceHint: source,
      onboardingStep: 4,
    },
  });

  return NextResponse.json({ migrationJobId: job.id }, { status: 201 });
}
