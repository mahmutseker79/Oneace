"use server";

import { db } from "@/lib/db";
import { requireActiveMembership } from "@/lib/session";
import {
  generateTotpSecret,
  verifyTotpCode,
  generateBackupCodes,
  verifyBackupCode,
} from "@/lib/totp";

/**
 * Enable 2FA for the current user.
 *
 * This action generates a TOTP secret and backup codes but does not yet
 * mark 2FA as enabled. The user must call verifyAndActivateTwoFactorAction
 * with the correct TOTP code to complete the setup.
 *
 * @returns Object containing secret, provisioning URI, and backup codes
 * @throws If user is not authenticated or doesn't have active membership
 */
export async function enableTwoFactorAction() {
  const { session } = await requireActiveMembership();
  const userId = session.user.id;

  // Check if user already has 2FA enabled
  // @ts-expect-error - TwoFactorAuth model added in latest migration, Prisma client will be regenerated
  const existing = await db.twoFactorAuth.findUnique({
    where: { userId },
  });

  if (existing?.enabled) {
    throw new Error("2FA is already enabled for this account.");
  }

  // Generate new secret and backup codes
  const { secret, uri, backupCodes } = generateTotpSecret(session.user.email);

  // Store the secret (not yet enabled) in the database
  // @ts-expect-error - TwoFactorAuth model added in latest migration, Prisma client will be regenerated
  await db.twoFactorAuth.upsert({
    where: { userId },
    create: {
      userId,
      secret,
      backupCodes,
      enabled: false,
    },
    update: {
      secret,
      backupCodes,
      enabled: false,
      verifiedAt: null,
    },
  });

  // Log the action (user-account events don't have org scope, so we skip audit logging
  // to keep it focused on org-level events; user security changes are implicitly audited
  // by the session trail)

  return {
    secret,
    uri,
    backupCodes,
  };
}

/**
 * Verify TOTP code and activate 2FA.
 *
 * This action verifies that the user has successfully added the TOTP secret
 * to their authenticator app by validating a code they provide, then marks
 * 2FA as enabled for future logins.
 *
 * @param code The 6-digit TOTP code from the user's authenticator app
 * @returns true if verification succeeded, false otherwise
 * @throws If user is not authenticated or 2FA setup is not in progress
 */
export async function verifyAndActivateTwoFactorAction(code: string): Promise<boolean> {
  const { session } = await requireActiveMembership();
  const userId = session.user.id;

  // Get the pending 2FA setup
  // @ts-expect-error - TwoFactorAuth model added in latest migration, Prisma client will be regenerated
  const twoFactorAuth = await db.twoFactorAuth.findUnique({
    where: { userId },
  });

  if (!twoFactorAuth) {
    throw new Error("No pending 2FA setup found. Call enableTwoFactorAction first.");
  }

  if (twoFactorAuth.enabled) {
    throw new Error("2FA is already enabled for this account.");
  }

  // Verify the TOTP code
  const isValid = verifyTotpCode(twoFactorAuth.secret, code);
  if (!isValid) {
    return false;
  }

  // Mark 2FA as enabled
  const now = new Date();
  // @ts-expect-error - TwoFactorAuth model added in latest migration, Prisma client will be regenerated
  await db.twoFactorAuth.update({
    where: { userId },
    data: {
      enabled: true,
      verifiedAt: now,
    },
  });

  // Note: User-account security changes are not recorded in org audit logs
  // as they are personal account settings, not org-scoped actions

  return true;
}

/**
 * Disable 2FA for the current user.
 *
 * Requires verification with the current TOTP code or a backup code
 * to prevent unauthorized disabling of 2FA.
 *
 * @param code 6-digit TOTP code or 8-character backup code
 * @returns true if disabling succeeded, false if code was invalid
 * @throws If user is not authenticated or 2FA is not enabled
 */
export async function disableTwoFactorAction(code: string): Promise<boolean> {
  const { session } = await requireActiveMembership();
  const userId = session.user.id;

  // Get the current 2FA setup
  // @ts-expect-error - TwoFactorAuth model added in latest migration, Prisma client will be regenerated
  const twoFactorAuth = await db.twoFactorAuth.findUnique({
    where: { userId },
  });

  if (!twoFactorAuth?.enabled) {
    throw new Error("2FA is not enabled for this account.");
  }

  // Try TOTP code first
  const isTotpValid = verifyTotpCode(twoFactorAuth.secret, code);
  if (isTotpValid) {
    // Delete the entire 2FA record
    // @ts-expect-error - TwoFactorAuth model added in latest migration, Prisma client will be regenerated
    await db.twoFactorAuth.delete({
      where: { userId },
    });

    return true;
  }

  // Try backup code
  const backupCodesCopy = [...twoFactorAuth.backupCodes];
  const backupResult = verifyBackupCode(backupCodesCopy, code);

  if (backupResult.valid) {
    // Delete the entire 2FA record (since they used a backup code to disable)
    // @ts-expect-error - TwoFactorAuth model added in latest migration, Prisma client will be regenerated
    await db.twoFactorAuth.delete({
      where: { userId },
    });

    return true;
  }

  // Neither code was valid
  return false;
}

/**
 * Regenerate backup codes for 2FA.
 *
 * Requires verification with the current TOTP code to prevent unauthorized
 * regeneration. This action voids all existing backup codes.
 *
 * @param code 6-digit TOTP code
 * @returns New set of backup codes if verification succeeded, null if failed
 * @throws If user is not authenticated or 2FA is not enabled
 */
export async function regenerateBackupCodesAction(code: string): Promise<string[] | null> {
  const { session } = await requireActiveMembership();
  const userId = session.user.id;

  // Get the current 2FA setup
  // @ts-expect-error - TwoFactorAuth model added in latest migration, Prisma client will be regenerated
  const twoFactorAuth = await db.twoFactorAuth.findUnique({
    where: { userId },
  });

  if (!twoFactorAuth?.enabled) {
    throw new Error("2FA is not enabled for this account.");
  }

  // Verify the TOTP code
  const isValid = verifyTotpCode(twoFactorAuth.secret, code);
  if (!isValid) {
    return null;
  }

  // Generate new backup codes
  const newBackupCodes = generateBackupCodes(10);

  // Update in database
  // @ts-expect-error - TwoFactorAuth model added in latest migration, Prisma client will be regenerated
  await db.twoFactorAuth.update({
    where: { userId },
    data: {
      backupCodes: newBackupCodes,
    },
  });

  return newBackupCodes;
}

/**
 * Get the current 2FA status for the user.
 *
 * @returns Object indicating if 2FA is enabled and when it was verified
 * @throws If user is not authenticated
 */
export async function getTwoFactorStatusAction() {
  const { session } = await requireActiveMembership();
  const userId = session.user.id;

  // @ts-expect-error - TwoFactorAuth model added in latest migration, Prisma client will be regenerated
  const twoFactorAuth = await db.twoFactorAuth.findUnique({
    where: { userId },
    select: {
      enabled: true,
      verifiedAt: true,
      createdAt: true,
      backupCodes: true,
    },
  });

  return {
    enabled: twoFactorAuth?.enabled ?? false,
    verifiedAt: twoFactorAuth?.verifiedAt ?? null,
    createdAt: twoFactorAuth?.createdAt ?? null,
    backupCodesRemaining: twoFactorAuth?.backupCodes.length ?? 0,
  };
}
