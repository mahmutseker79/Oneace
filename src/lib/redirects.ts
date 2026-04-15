/**
 * Sprint 33: safe-redirect validation for auth query params.
 *
 * The login and register forms accept a `next` query param so that an
 * unauthenticated user hitting (for example) `/invite/{token}` can be
 * sent to `/login?next=/invite/{token}` and land back on the invite
 * page post-sign-in. Without a validator this is an open-redirect
 * vector:
 *
 *   /login?next=https://evil.example/phish
 *
 * ...would silently bounce a freshly-signed-in user off our origin
 * after they've already entered credentials. Classic phishing primer.
 *
 * Rules:
 *   - Must be a non-empty string
 *   - Must start with exactly one `/` (not `//` — that's a
 *     protocol-relative URL which browsers interpret as cross-origin)
 *   - Must not contain `\` (Windows-style separators can trip some
 *     browser URL parsers into treating the path as a host)
 *   - Must not contain `@` (userinfo injection, e.g.
 *     `/@evil.example`)
 *   - Must not contain control chars (newline/CR/tab)
 *
 * Anything failing these checks falls back to the default (typically
 * `/dashboard`). We deliberately do NOT try to decode and reparse the
 * URL — an allowlist of character classes is strict and predictable,
 * and keeping the helper pure/synchronous means it runs fine in any
 * `"use client"` component without needing a polyfill for `URL` on
 * stale bundlers.
 */

/**
 * Returns true if `value` is safe to use as a same-origin redirect
 * target. Callers should fall back to a default path otherwise.
 */
export function isSafeRedirect(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.length === 0) return false;
  if (value.length > 512) return false; // pathological length guard
  if (!value.startsWith("/")) return false;
  if (value.startsWith("//")) return false; // protocol-relative
  if (value.includes("\\")) return false;
  if (value.includes("@")) return false;
  // Control characters: \t \n \r and anything below 0x20
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return false;
  }
  return true;
}

/**
 * Resolve a `next` query param to a safe redirect path. Returns the
 * `fallback` (defaulting to `/dashboard`) for any unsafe or missing
 * input.
 */
export function resolveSafeRedirect(value: unknown, fallback = "/dashboard"): string {
  return isSafeRedirect(value) ? value : fallback;
}
