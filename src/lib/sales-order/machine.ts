import type { SalesOrderStatus } from "@/generated/prisma";

/**
 * Sales Order state machine. Tracks valid status transitions.
 * DRAFT → CONFIRMED → ALLOCATED → PARTIALLY_SHIPPED → SHIPPED | CANCELLED
 */

export function canConfirm(status: SalesOrderStatus): boolean {
  return status === "DRAFT";
}

export function canAllocate(status: SalesOrderStatus): boolean {
  return status === "CONFIRMED";
}

export function canShip(status: SalesOrderStatus): boolean {
  return status === "ALLOCATED" || status === "PARTIALLY_SHIPPED";
}

export function canCancel(status: SalesOrderStatus): boolean {
  return status === "DRAFT" || status === "CONFIRMED" || status === "ALLOCATED";
}

export function canAddLines(status: SalesOrderStatus): boolean {
  return status === "DRAFT";
}

export function canRemoveLines(status: SalesOrderStatus): boolean {
  return status === "DRAFT";
}

export function isReadOnly(status: SalesOrderStatus): boolean {
  return status === "SHIPPED" || status === "CANCELLED";
}
