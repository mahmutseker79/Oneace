import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Purchase orders — OneAce Docs",
  description:
    "Create purchase orders, receive stock with barcode assistance, and track supplier deliveries.",
};

export default function PurchaseOrdersPage() {
  return (
    <article className="prose prose-sm max-w-none dark:prose-invert">
      <h1>Purchase orders</h1>
      <p className="lead">
        Purchase orders (POs) are available on the <strong>Pro and Business plans</strong>. They let
        you track supplier orders, receive incoming stock with barcode assistance, and automatically
        update inventory levels.
      </p>

      <h2>Creating a purchase order</h2>
      <ol>
        <li>
          Go to <strong>Purchase orders → New PO</strong>
        </li>
        <li>Select a supplier and destination warehouse</li>
        <li>Add line items — each line is an item + quantity + unit cost</li>
        <li>
          Click <strong>Save</strong> to create a draft
        </li>
        <li>
          When ready to send, click <strong>Mark as sent</strong>
        </li>
      </ol>

      <h2>Receiving stock</h2>
      <p>
        When goods arrive, click <strong>Receive stock</strong> on the PO detail page. You&apos;ll
        see each line with its ordered and remaining quantity.
      </p>
      <p>
        <strong>Scan-assisted receiving:</strong> The scan input at the top of the receive form
        auto-detects items as you scan them (barcode or SKU match). Each scan adds 1 to the quantity
        for that line. You can also type quantities manually.
      </p>
      <p>
        Click <strong>Post receipt</strong> when done. Stock levels update immediately, and the PO
        status moves to Partially Received or Received.
      </p>

      <h2>Putaway after receiving</h2>
      <p>
        After receiving, stock lands at the warehouse level (unassigned to a bin). If you use bins,
        the success screen shows a <strong>Putaway to bins</strong> button that takes you directly
        to the putaway flow.
      </p>

      <h2>Partial receipts</h2>
      <p>
        You can receive a PO multiple times. If supplier sends 60 of 100 items, receive 60 — the PO
        shows as Partially Received. Receive the remaining 40 on a later delivery.
      </p>

      <h2>Low-stock alerts and auto-reorder</h2>
      <p>
        Set a reorder point on each item. When on-hand stock falls at or below that point, a
        low-stock alert fires (Pro plan). The low-stock report shows items grouped by supplier with
        a one-click PO creation button.
      </p>
    </article>
  );
}
