import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { calculateLabelsPerPage, renderLabel } from "@/lib/labels/label-renderer";
import { requireActiveMembership } from "@/lib/session";

/**
 * POST /api/labels/custom/pdf
 *
 * Generate a PDF with custom labels from a template and entity data.
 *
 * Request body:
 * {
 *   templateId: string,
 *   items: [
 *     { type: "warehouse" | "bin" | "item", id: string },
 *     ...
 *   ]
 * }
 *
 * Returns: PDF file or error
 */

const requestSchema = z.object({
  templateId: z.string().min(1),
  items: z
    .array(
      z.object({
        type: z.enum(["warehouse", "bin", "item"]),
        id: z.string().min(1),
      }),
    )
    .min(1),
});

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const { membership } = await requireActiveMembership();

    // Parse request body
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.errors },
        { status: 400 },
      );
    }

    const { templateId, items } = parsed.data;

    // Verify template belongs to the organization
    const template = await db.labelTemplate.findFirst({
      where: { id: templateId, organizationId: membership.organizationId },
    });

    if (!template) {
      return NextResponse.json({ error: "Label template not found" }, { status: 404 });
    }

    // Fetch entity data
    const renderedLabels = [];

    for (const item of items) {
      let entityData: Record<string, unknown> | null = null;

      if (item.type === "warehouse") {
        entityData = await db.warehouse.findFirst({
          where: { id: item.id, organizationId: membership.organizationId },
          select: { id: true, name: true, code: true, barcodeValue: true },
        });
      } else if (item.type === "bin") {
        const bin = await db.bin.findFirst({
          where: { id: item.id },
          select: {
            id: true,
            code: true,
            label: true,
            barcodeValue: true,
            displayName: true,
            warehouse: { select: { code: true } },
          },
        });

        if (bin) {
          // Verify warehouse belongs to organization
          const warehouseCheck = await db.bin.findFirst({
            where: { id: item.id },
            include: { warehouse: { select: { organizationId: true } } },
          });

          if (warehouseCheck?.warehouse.organizationId === membership.organizationId) {
            entityData = {
              id: bin.id,
              code: bin.code,
              name: bin.label || bin.displayName || `Bin ${bin.code}`,
              barcodeValue: bin.barcodeValue,
              warehouseCode: bin.warehouse.code,
            };
          }
        }
      } else if (item.type === "item") {
        entityData = await db.item.findFirst({
          where: { id: item.id, organizationId: membership.organizationId },
          select: { id: true, sku: true, name: true, barcode: true },
        });
      }

      if (entityData) {
        const rendered = renderLabel(template, item.type, entityData);
        renderedLabels.push(rendered);
      }
    }

    if (renderedLabels.length === 0) {
      return NextResponse.json({ error: "No valid items found" }, { status: 404 });
    }

    // Calculate page layout
    const pageLayout = calculateLabelsPerPage(template.width, template.height);

    // For now, return JSON with rendered labels
    // In production, this would generate a PDF using a library like pdfkit or puppeteer
    // This is a placeholder response that includes all rendered label data
    const response = {
      templateId: template.id,
      templateName: template.name,
      pageLayout,
      totalLabels: renderedLabels.length,
      labels: renderedLabels,
    };

    return NextResponse.json(response, {
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Label PDF generation error:", error);
    return NextResponse.json({ error: "Failed to generate label PDF" }, { status: 500 });
  }
}
