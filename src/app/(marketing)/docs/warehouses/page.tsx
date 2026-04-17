import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Warehouses & bins — OneAce Docs",
  description: "Set up warehouse locations and bin-level tracking in OneAce.",
};

export default function WarehousesPage() {
  return (
    <article className="prose prose-sm max-w-none dark:prose-invert">
      <h1>Warehouses &amp; bins</h1>
      <p className="lead">
        OneAce tracks stock at the warehouse level and optionally at the bin level within each
        warehouse. The Free plan includes one warehouse; Pro and Business plans include unlimited.
      </p>

      <h2>Creating a warehouse</h2>
      <p>
        Go to <strong>Locations → New location</strong>. Each warehouse has a name and a short code
        (e.g. &quot;WH-A&quot;). You can optionally set address details for display purposes.
      </p>
      <p>One warehouse can be marked as the default — it&apos;s pre-selected in movements.</p>

      <h2>Bins (shelves, racks, zones)</h2>
      <p>
        Bins are sub-locations within a warehouse — shelves, racks, aisles, or zones. Bin-level
        tracking requires the <strong>Pro or Business plan</strong>.
      </p>
      <p>To set up bins:</p>
      <ol>
        <li>
          Open a warehouse and click <strong>Bins</strong>
        </li>
        <li>
          Click <strong>New bin</strong> and enter a code (e.g. &quot;A-01-03&quot;) and optional
          label
        </li>
        <li>
          Print barcode labels for your bins via the <strong>Print labels</strong> button
        </li>
      </ol>

      <h2>Assigning stock to bins</h2>
      <p>
        When you receive stock from a purchase order, the received quantity lands at the warehouse
        level (unassigned to a bin). Use the <strong>Putaway</strong> flow to assign items to
        specific bins:
      </p>
      <ol>
        <li>
          After receiving a PO, click <strong>Putaway to bins</strong>
        </li>
        <li>For each item, select the target bin and enter the quantity to assign</li>
        <li>
          Click <strong>Confirm putaway</strong>
        </li>
      </ol>

      <h2>Inter-warehouse transfers</h2>
      <p>
        Move stock between warehouses using the <strong>Transfer stock</strong> wizard (Pro plan):
      </p>
      <ol>
        <li>
          Go to <strong>Movements → Transfer stock</strong>
        </li>
        <li>Select source and destination warehouses</li>
        <li>Add items and quantities (or scan to add)</li>
        <li>Review and confirm</li>
      </ol>
      <p>Transfers are audited — each line creates a TRANSFER movement in the ledger.</p>

      <h2>Bin inventory report</h2>
      <p>
        See all bin-level stock across your warehouses at <strong>Reports → Bin inventory</strong>.
        Export to CSV for spreadsheet use.
      </p>
    </article>
  );
}
