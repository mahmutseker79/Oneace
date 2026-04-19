/**
 * Audit v1.3 §5.53 F-09 — Handler registration barrel.
 *
 * Each per-adapter `register.ts` is imported here for its side
 * effects (the `registerHandler(...)` call at module top-level).
 * `/api/cron/integration-tasks/route.ts` imports THIS file (not
 * the individual register modules) so the cron is agnostic to how
 * many adapters exist.
 *
 * Adding a new adapter = one line here + one `register.ts` next to
 * the adapter code. The cron route file never changes.
 *
 * B-1 Shopify wiring lands first; subsequent wiring PRs append.
 */

/* eslint-disable import/no-unassigned-import */

// B-1 — audit §5.53 F-09 Shopify pilot.
import "../shopify/register";
