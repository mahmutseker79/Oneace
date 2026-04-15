// StockCount state machine — pure, no imports from Prisma.
//
// State lifecycle:
//
//   OPEN ──► IN_PROGRESS ──► COMPLETED
//     │           │
//     │           └─────────► CANCELLED
//     └─────────────────────► CANCELLED
//
// COMPLETED and CANCELLED are terminal. Once a count enters a terminal
// state the snapshot + entries become read-only audit material.
//
// OPEN → IN_PROGRESS is automatic on the first count entry. All other
// transitions are user-triggered from the detail page.

export type StockCountState = "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export const TERMINAL_STATES: ReadonlySet<StockCountState> = new Set(["COMPLETED", "CANCELLED"]);

export const EDITABLE_STATES: ReadonlySet<StockCountState> = new Set(["OPEN", "IN_PROGRESS"]);

export function isTerminal(state: StockCountState): boolean {
  return TERMINAL_STATES.has(state);
}

export function isEditable(state: StockCountState): boolean {
  return EDITABLE_STATES.has(state);
}

/**
 * Returns true if `from` can legally transition to `to`.
 * Unknown transitions return false — the caller is expected to surface
 * a friendly error. Transitioning to the same state is always false,
 * since state changes must be explicit.
 */
export function canTransition(from: StockCountState, to: StockCountState): boolean {
  if (from === to) return false;
  if (from === "OPEN" && (to === "IN_PROGRESS" || to === "CANCELLED")) return true;
  if (from === "IN_PROGRESS" && (to === "COMPLETED" || to === "CANCELLED")) return true;
  return false;
}

/**
 * Returns true if the count can accept a new physical entry.
 */
export function canAddEntry(state: StockCountState): boolean {
  return state === "OPEN" || state === "IN_PROGRESS";
}

/**
 * Returns true if the count can be cancelled.
 */
export function canCancel(state: StockCountState): boolean {
  return state === "OPEN" || state === "IN_PROGRESS";
}

/**
 * Returns true if the count is eligible for reconcile.
 * Reconcile is a terminal step, so the count must be IN_PROGRESS — you
 * can't reconcile a count that has zero entries.
 */
export function canReconcile(state: StockCountState): boolean {
  return state === "IN_PROGRESS";
}
