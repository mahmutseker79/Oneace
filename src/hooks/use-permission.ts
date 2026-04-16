"use client";

/**
 * usePermission Hook
 *
 * Reads the current user's membership role from session context and
 * checks whether they have a specific capability.
 *
 * This is a foundation hook for client-side permission checks. Currently,
 * it's a stub that can be extended once session context is available on
 * the client side.
 *
 * Usage:
 *   const canDeleteItems = usePermission("items.delete");
 *   if (!canDeleteItems) return null;
 */

import type { Capability } from "@/lib/permissions";

// TODO: Once a client-side session context is available (via SessionProvider
// or similar), replace this stub with actual session reading.
// For now, this returns false as a safe default.

export function usePermission(capability: Capability): boolean {
  // Placeholder: always returns false until session context is available.
  // When integrated with a client-side session provider, this will read
  // the user's role from context and call hasCapability(role, capability).
  return false;
}
