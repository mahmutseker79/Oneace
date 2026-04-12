/**
 * Returns a compact relative-time description like "2h ago" or "3d ago".
 *
 * Intentionally simple — no Intl dependency, no locale plumbing.
 * Used for lightweight trust cues (P7.7) where "3d ago" is precise
 * enough and the overhead of a full date-fns / Intl chain is not
 * warranted.
 */
export function formatRelative(date: Date, now = new Date(), locale?: string): string {
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 30) return `${diffDay}d ago`;

  // Older than 30 days — show a compact date
  return date.toLocaleDateString(locale ?? "en-US", {
    month: "short",
    day: "numeric",
  });
}
