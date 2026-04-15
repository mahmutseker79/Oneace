// Phase 4A — shared action-result shape and field-error stripper.
//
// Three action files (movements, stock-counts, purchase-orders) were
// carrying near-identical copies of `ActionResult<T>` and the "strip
// undefined entries out of a discriminated-union fieldErrors" helper.
// This module is the single source of truth for both. The helper is
// deliberately tiny; any richer action-result machinery belongs in a
// dedicated server-layer module, not here.

/**
 * Discriminated-union return type for server actions. The generic
 * parameter is the success-branch payload — the default
 * `{ id: string }` matches the classic create/update/delete shape,
 * and stock-counts callers override it (e.g. `{ entryId: string }`,
 * `{ id: string; postedMovements: number }`).
 */
export type ActionResult<T extends object = { id: string }> =
  | ({ ok: true } & T)
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * Zod's `.flatten().fieldErrors` on a discriminated union produces
 * `Record<string, string[] | undefined>` because any key may be
 * missing from a narrowed variant. Passing that through to the client
 * leaks `undefined` into the ActionResult shape, so every writer has
 * to strip it. This helper is that strip.
 */
export function cleanFieldErrors(
  raw: Record<string, string[] | undefined>,
): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value && value.length > 0) fieldErrors[key] = value;
  }
  return fieldErrors;
}
