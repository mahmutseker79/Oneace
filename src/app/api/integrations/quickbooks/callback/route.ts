/**
 * Phase E: QuickBooks OAuth 2.0 callback route.
 *
 * Handles the OAuth redirect from QuickBooks during the authorization flow.
 * Exchanges the authorization code for an access token.
 */

import { createHmac } from "node:crypto";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { QBOClient } from "@/lib/integrations/quickbooks/qbo-client";
import { logger } from "@/lib/logger";
import { type NextRequest, NextResponse } from "next/server";

function verifyOAuthState(
  state: string,
  secret: string,
): { organizationId: string; userId: string } | null {
  const parts = state.split("|");
  if (parts.length !== 4) return null; // expect orgId|userId|timestamp|signature
  const [organizationId, userId, timestamp, signature] = parts;
  if (!organizationId || !userId || !timestamp || !signature) return null;

  // Validate timestamp is within 10 minutes
  const stateTime = Number.parseInt(timestamp, 10);
  if (Number.isNaN(stateTime)) return null;
  const now = Date.now();
  const maxAge = 10 * 60 * 1000; // 10 minutes in milliseconds
  if (now - stateTime > maxAge) return null;

  const expected = createHmac("sha256", secret)
    .update(`${organizationId}|${userId}|${timestamp}`)
    .digest("hex");
  if (signature !== expected) return null;
  return { organizationId, userId };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const realmId = searchParams.get("realmId");

    if (!code || !state || !realmId) {
      return NextResponse.json({ error: "Missing OAuth parameters" }, { status: 400 });
    }

    // Verify state parameter with HMAC signature
    const verified = verifyOAuthState(state, env.BETTER_AUTH_SECRET);
    if (!verified) {
      logger.warn("QuickBooks OAuth state verification failed", {
        state,
      });
      return NextResponse.json({ error: "Invalid state parameter" }, { status: 403 });
    }

    const { organizationId, userId } = verified;

    // Initialize QBO client to exchange code for token
    const client = new QBOClient({ accessToken: "", expiresAt: 0 }, realmId);

    // Exchange code for token
    const token = await client.exchangeCodeForToken(code);

    // Test connection by fetching company info
    client.setCredentials(token);
    let companyName = "";
    try {
      const companyInfo = await client.getCompanyInfo();
      companyName = companyInfo.companyName;
    } catch (companyError) {
      logger.warn("Could not fetch QBO company info during connect", { companyError });
    }

    // Upsert integration (handles reconnection case)
    await db.integration.upsert({
      where: {
        organizationId_provider: {
          organizationId,
          provider: "QUICKBOOKS_ONLINE",
        },
      },
      create: {
        organizationId,
        provider: "QUICKBOOKS_ONLINE",
        status: "CONNECTED",
        externalAccountId: realmId,
        externalStoreName: companyName || undefined,
        credentials: {
          accessToken: token.accessToken,
          refreshToken: token.refreshToken,
          expiresAt: token.expiresAt,
          realmId,
        },
        settings: {
          connectedAt: new Date().toISOString(),
          connectedBy: userId,
          companyName,
        },
        syncItems: true,
        syncOrders: true,
        syncSuppliers: true,
        syncCustomers: true,
        syncStockLevels: true,
        syncPrices: true,
      },
      update: {
        status: "CONNECTED",
        externalAccountId: realmId,
        externalStoreName: companyName || undefined,
        credentials: {
          accessToken: token.accessToken,
          refreshToken: token.refreshToken,
          expiresAt: token.expiresAt,
          realmId,
        },
        settings: {
          connectedAt: new Date().toISOString(),
          connectedBy: userId,
          companyName,
          reconnectedAt: new Date().toISOString(),
        },
        lastError: null,
      },
    });

    logger.info("QuickBooks integration connected", {
      organizationId,
      realmId,
      companyName,
    });

    // Redirect to integrations page with success message
    return NextResponse.redirect(new URL("/integrations/quickbooks?status=success", request.url));
  } catch (error) {
    logger.error("QuickBooks OAuth callback error", { error });

    return NextResponse.redirect(new URL("/integrations/quickbooks?status=error", request.url));
  }
}
