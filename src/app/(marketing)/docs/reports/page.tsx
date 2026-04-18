import type { Metadata } from "next";

import { buildMarketingMetadata } from "@/lib/seo/marketing-metadata";

export const metadata: Metadata = buildMarketingMetadata({
  title: "Reports & exports — OneAce Docs",
  description: "View stock value, movement history, bin inventory, and export data in OneAce.",
  path: "/docs/reports",
});

export default function ReportsPage() {
  return (
    <article className="prose prose-sm max-w-none dark:prose-invert">
      <h1>Reports &amp; exports</h1>
      <p className="lead">
        Reports and exports are available on <strong>Pro and Business plans</strong>. The Free plan
        includes the movements ledger but no export capability.
      </p>

      <h2>Available reports</h2>

      <h3>Low stock</h3>
      <p>
        Shows all active items at or below their reorder point, grouped by preferred supplier. Use
        the one-click <strong>Create PO for this supplier</strong> button to start a purchase order.
      </p>

      <h3>Stock value</h3>
      <p>
        Shows the at-cost value of all on-hand inventory, grouped by warehouse. Useful for finance
        snapshots and month-end close. Items without a cost price are flagged.
      </p>

      <h3>Movement history</h3>
      <p>
        Aggregated view of stock movements with KPI cards (total receipts, issues, transfers,
        adjustments, net units). Filter by date range and movement type.
      </p>

      <h3>Bin inventory</h3>
      <p>
        Shows stock assigned to specific bins within each warehouse. Helps locate items without a
        physical search.
      </p>

      <h3>Supplier performance</h3>
      <p>
        Tracks received value, PO count, on-time rate, and average lead time per supplier. Only
        shown when you have active suppliers.
      </p>

      <h2>Exports</h2>
      <p>All reports support CSV export. Some support Excel (.xlsx) with formatted headers.</p>
      <p>You can also export:</p>
      <ul>
        <li>
          <strong>Items list</strong> — from the Items page export button
        </li>
        <li>
          <strong>Movements</strong> — from the Movements page export button
        </li>
        <li>
          <strong>Purchase orders</strong> — from the Purchase orders page
        </li>
      </ul>

      <h2>Audit log</h2>
      <p>
        The <strong>Audit log</strong> (Business plan only) shows a complete history of all
        mutations: who created/edited/deleted what, and when. Includes billing plan changes
        (upgrades, downgrades, payment failures).
      </p>
    </article>
  );
}
