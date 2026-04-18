// StockCount state machine — pure, no imports from Prisma.
//
// State lifecycle:
//
//   OPEN ──► IN_PROGRESS ──► REQUIRES_RECOUNT ──► IN_PROGRESS ──► COMPLETED
//     │           │                                                  │
//     │           └──────────────────────────────────────────────────┤
//     │                                                               │
//     └───────────────────► CANCELLED ◄─────────────────────────────┘
//
// COMPLETED and CANCELLED are terminal. Once a count enters a terminal
// state the snapshot + entries become read-only audit material.
//
// OPEN → IN_PROGRESS is automatic on the first count entry. All other
// transitions are user-triggered from the detail page.
//
// REQUIRES_RECOUNT is entered when variance evaluation indicates items
// exceed the threshold. Users can then re-enter IN_PROGRESS to add
// additional entries, then reconcile.

export type StockCountState =
  | "OPEN"
  | "IN_PROGRESS"
  | "REQUIRES_RECOUNT"
  | "COMPLETED"
  | "CANCELLED"
  // Phase 17+: approval workflow + rollback states
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "ROLLED_BACK";

export const TERMINAL_STATES: ReadonlySet<StockCountState> = new Set([
  "COMPLETED",
  "CANCELLED",
  "ROLLED_BACK",
]);

export const EDITABLE_STATES: ReadonlySet<StockCountState> = new Set([
  "OPEN",
  "IN_PROGRESS",
  "REQUIRES_RECOUNT",
]);

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
  if (
    from === "IN_PROGRESS" &&
    (to === "COMPLETED" || to === "CANCELLED" || to === "REQUIRES_RECOUNT")
  )
    return true;
  if (from === "REQUIRES_RECOUNT" && (to === "IN_PROGRESS" || to === "CANCELLED")) return true;
  // Phase 17+: approval workflow transitions
  if (from === "IN_PROGRESS" && to === "PENDING_APPROVAL") return true;
  if (from === "PENDING_APPROVAL" && to === "APPROVED") return true;
  if (from === "PENDING_APPROVAL" && to === "REJECTED") return true;
  if (from === "APPROVED" && to === "COMPLETED") return true;
  if (from === "REJECTED" && to === "IN_PROGRESS") return true;
  // Phase 17+: rollback from completed — DISABLED by P0-4 (audit v1.0).
  // See `canRollback` for rationale. The transition stays defined here
  // in a comment so the real implementation knows where to re-enable it.
  // if (from === "COMPLETED" && to === "ROLLED_BACK") return true;
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
 * Returns true if the count can trigger a recount.
 * Recount is only available when IN_PROGRESS and variance evaluation
 * has identified items exceeding the threshold.
 */
export function canTriggerRecount(state: StockCountState): boolean {
  return state === "IN_PROGRESS";
}

/**
 * Returns true if the count is in the requires-recount state.
 * Used to show different UI and filter entries to only flagged items.
 */
export function isRecountRequired(state: StockCountState): boolean {
  return state === "REQUIRES_RECOUNT";
}

/**
 * Returns true if the count is eligible for reconcile.
 * Reconcile is a terminal step, so the count must be IN_PROGRESS or
 * REQUIRES_RECOUNT can transition to IN_PROGRESS then reconcile.
 */
export function canReconcile(state: StockCountState): boolean {
  return state === "IN_PROGRESS";
}

// -----------------------------------------------------------------------
// Phase 17+: approval workflow + rollback helpers
// -----------------------------------------------------------------------

/**
 * Returns true if the count can be submitted for approval.
 * Only IN_PROGRESS counts can be submitted.
 */
export function canSubmitForApproval(state: StockCountState): boolean {
  return state === "IN_PROGRESS";
}

/**
 * Returns true if the count can be approved.
 * Only PENDING_APPROVAL counts can be approved.
 */
export function canApprove(state: StockCountState): boolean {
  return state === "PENDING_APPROVAL";
}

/**
 * Returns true if the count can be rejected.
 * Only PENDING_APPROVAL counts can be rejected.
 */
export function canReject(state: StockCountState): boolean {
  return state === "PENDING_APPROVAL";
}

/**
 * Returns true if the count can be safely rolled back.
 *
 * P0-4 remediation (audit v1.0): rollback previously reported "success"
 * for any COMPLETED count but did NOT reverse the posted stock movements
 * — it only flipped the state label. That silently diverged the ledger
 * from inventory state. Until a true reversing-movement implementation
 * lands, we refuse rollback for every state.
 *
 * Pre-post states (OPEN / IN_PROGRESS / REQUIRES_RECOUNT /
 * PENDING_APPROVAL) should use CANCEL or REJECT instead — both real,
 * implemented transitions that don't require any movement reversal.
 *
 * When real rollback is implemented, this function should return true
 * ONLY for states where the inverse-movement generator knows how to
 * undo the reconciliation atomically in a transaction.
 */
export function canRollback(_state: StockCountState): boolean {
  return false;
}

/**
 * Reason a given state cannot be rolled back, for surfacing a specific
 * error code/string to the caller. Returns null if `canRollback` would
 * have returned true (defensive — today it never does).
 */
export function rollbackDenialReason(state: StockCountState): string | null {
  if (canRollback(state)) return null;
  if (state === "COMPLETED" || state === "APPROVED") {
    return "CANNOT_ROLLBACK_POST_POSTED";
  }
  if (state === "ROLLED_BACK" || state === "CANCELLED" || state === "REJECTED") {
    return "CANNOT_ROLLBACK_TERMINAL";
  }
  return "CANNOT_ROLLBACK_PRE_POST";
}

/**
 * Returns true if the count requires approval before stock transfer.
 * Checked at reconcile time — if true, the count transitions to
 * PENDING_APPROVAL instead of COMPLETED.
 */
export function requiresApproval(count: { requiresApproval: boolean }): boolean {
  return count.requiresApproval === true;
}
