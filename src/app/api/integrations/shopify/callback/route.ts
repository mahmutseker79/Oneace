/**
 * Phase E: Shopify OAuth 2.0 callback route.
 *
 * Handles the OAuth redirect from Shopify during the authorization flow.
 * Exchanges the authorization code for an access token.
 */

import { createHmac } from "node:crypto";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { ShopifyClient } from "@/lib/integrations/shopify/shopify-client";
import { logger } from "@/lib/logger";
import { type NextRequest, NextResponse } from "next/server";

function verifyOAuthState(
  state: string,
  secret: string,
): { organizationId: string; userId: string } | null {
  const parts = state.split("|");
  if (parts.length !== 3) return null; // expect orgId|userId|signature
  const [organizationId, userId, signature] = parts;
  if (!organizationId || !userId || !signature) return null;
  const expected = createHmac("sha256", secret).update(`${organizationId}|${userId}`).digest("hex");
  if (signature !== expected) return null;
  return { organizationId, userId };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const shop = searchParams.get("shop");
    const hmac = searchParams.get("hmac");

    if (!code || !state || !shop || !hmac) {
      return NextResponse.json({ error: "Missing OAuth parameters" }, { status: 400 });
    }

    // Verify state parameter with HMAC signature
    const verified = verifyOAuthState(state, env.BETTER_AUTH_SECRET);
    if (!verified) {
      logger.warn("Shopify OAuth state verification failed", {
        state,
      });
      return NextResponse.json({ error: "Invalid state parameter" }, { status: 403 });
    }

    const { organizationId, userId } = verified;

    // Initialize Shopify client to exchange code for token
    const client = new ShopifyClient({ accessToken: "", expiresAt: 0 }, shop);

    // Exchange code for token
    const token = await client.exchangeCodeForToken(code);

    // Store integration in database
    await db.integration.create({
      data: {
        organizationId,
        provider: "SHOPIFY",
        status: "CONNECTED",
        credentials: {
          accessToken: token.accessToken,
          expiresAt: token.expiresAt,
          shop,
        },
        settings: {
          connectedAt: new Date().toISOString(),
          connectedBy: userId,
          shop,
        },
      },
    });

    logger.info("Shopify integration connected", {
      organizationId,
      shop,
    });

    // Redirect to settings page with success message
    return NextResponse.redirect(
      new URL("/settings/integrations/shopify?status=success", request.url),
    );
  } catch (error) {
    logger.error("Shopify OAuth callback error", { error });

    return NextResponse.redirect(
      new URL("/settings/integrations/shopify?status=error", request.url),
    );
  }
}
