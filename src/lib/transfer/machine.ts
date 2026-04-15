/**
 * Phase L4 — Stock transfer state machine.
 *
 * State transitions:
 *   DRAFT → SHIPPED → IN_TRANSIT → RECEIVED
 *   DRAFT → SHIPPED → IN_TRANSIT → CANCELLED
 *   DRAFT → SHIPPED → CANCELLED
 *   DRAFT → CANCELLED
 *
 * Terminal states: RECEIVED, CANCELLED
 */

import { TransferStatus } from "@/generated/prisma";

/**
 * Check if a transfer can transition to SHIPPED (outbound).
 * Only DRAFT transfers can be shipped.
 */
export function canShip(status: TransferStatus): boolean {
  return status === "DRAFT";
}

/**
 * Check if a transfer can transition to RECEIVED (inbound completion).
 * Only IN_TRANSIT transfers can be received.
 */
export function canReceive(status: TransferStatus): boolean {
  return status === "IN_TRANSIT";
}

/**
 * Check if a transfer can be cancelled.
 * DRAFT, SHIPPED, and IN_TRANSIT transfers can be cancelled.
 * RECEIVED and CANCELLED are terminal and cannot be modified.
 */
export function canCancel(status: TransferStatus): boolean {
  return status === "DRAFT" || status === "SHIPPED" || status === "IN_TRANSIT";
}

/**
 * Check if a transfer is in a terminal state.
 * RECEIVED and CANCELLED are terminal — no further transitions possible.
 */
export function isTerminal(status: TransferStatus): boolean {
  return status === "RECEIVED" || status === "CANCELLED";
}

/**
 * Get the display label for a transfer status.
 */
export function statusLabel(status: TransferStatus): string {
  const labels: Record<TransferStatus, string> = {
    DRAFT: "Draft",
    SHIPPED: "Shipped",
    IN_TRANSIT: "In Transit",
    RECEIVED: "Received",
    CANCELLED: "Cancelled",
  };
  return labels[status];
}

/**
 * Get the badge color variant for a transfer status.
 */
export function statusBadgeVariant(status: TransferStatus): string {
  const variants: Record<TransferStatus, string> = {
    DRAFT: "outline",
    SHIPPED: "secondary",
    IN_TRANSIT: "blue",
    RECEIVED: "success",
    CANCELLED: "destructive",
  };
  return variants[status];
}
