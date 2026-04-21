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
// B-2 — audit §5.53 F-09 QuickBooks Online (14 ERP entity kinds).
import "../quickbooks/register";
// Phase-3.2 C wave — audit §5.53 F-09 10-adapter pending-execution wiring.
// Each register module is a side-effect import; per-adapter rationale
// in the individual files (see amazon/register.ts for the shared
// "pending execution" pattern).
import "../amazon/register";
import "../bigcommerce/register";
import "../magento/register";
import "../odoo/register";
import "../wix/register";
import "../woocommerce/register";
import "../xero/register";
import "../zoho/register";
import "../quickbooks-desktop/register";
import "../custom-webhook/register";
