/**
 * Phase MIG-S2 — Migrations list and creation endpoint.
 *
 * GET  /api/migrations     — list migrations for the current organization
 * POST /api/migrations     — create a new migration job
 */

import type { MigrationSource } from "@/generated/prisma";
import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// GET: List migrations
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { membership } = await requireActiveMembership();

    const jobs = await db.migrationJob.findMany({
      where: { organizationId: membership.organizationId },
      orderBy: { updatedAt: "desc" },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({ migrations: jobs }, { status: 200 });
  } catch (error) {
    console.error("GET /api/migrations error:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to list migrations" },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST: Create a new migration job
// ─────────────────────────────────────────────────────────────────────────────

// Audit fix (Critical-1): the 7 ACTIVE migration sources must all be
// acceptable here, otherwise the POST route rejects QUICKBOOKS_ONLINE /
// QUICKBOOKS_DESKTOP with 400 even though adapters exist for both. The
// MigrationSource enum in Prisma has more values (KATANA, LIGHTSPEED,
// QUICKBOOKS_COMMERCE, etc.) but those have no adapter yet — the UI
// never sends them and the factory throws if they slip through.
const CreateMigrationSchema = z.object({
  source: z.enum([
    "SORTLY",
    "INFLOW",
    "FISHBOWL",
    "CIN7",
    "SOS_INVENTORY",
    "QUICKBOOKS_ONLINE",
    "QUICKBOOKS_DESKTOP",
  ] as const),
});

type CreateMigrationRequest = z.infer<typeof CreateMigrationSchema>;

export async function POST(request: NextRequest) {
  try {
    const { membership, user } = await requireActiveMembership();

    // Check permission
    if (!hasCapability(membership.role, "integrations.connect")) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Insufficient permissions" },
        { status: 403 },
      );
    }

    // Parse and validate body
    const body = await request.json();
    const parsed = CreateMigrationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "BAD_REQUEST", message: "Invalid request body" },
        { status: 400 },
      );
    }

    const { source } = parsed.data;

    // Create the migration job in PENDING state
    const job = await db.migrationJob.create({
      data: {
        organizationId: membership.organizationId,
        sourcePlatform: source as MigrationSource,
        status: "PENDING",
        createdById: user.id,
      },
    });

    // Audit log
    await recordAudit({
      db,
      organizationId: membership.organizationId,
      action: "migration.created",
      actor: user,
      entity: { type: "MigrationJob", id: job.id },
      metadata: { source },
    });

    return NextResponse.json({ migration: job }, { status: 201 });
  } catch (error) {
    console.error("POST /api/migrations error:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to create migration" },
      { status: 500 },
    );
  }
}
