import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Getting started — OneAce Docs",
  description:
    "Set up OneAce in 5 minutes. Add items, create a warehouse, and record your first stock movement.",
};

export default function GettingStartedPage() {
  return (
    <article className="prose prose-sm max-w-none dark:prose-invert">
      <h1>Getting started</h1>
      <p className="lead">
        OneAce takes about 5 minutes to set up. This guide walks you through creating your first
        item, setting up a warehouse, and recording your first movement.
      </p>

      <h2>Step 1 — Create your account</h2>
      <p>
        Visit <Link href="/register">/register</Link> and enter your name, organization name, email,
        and password. OneAce creates your organization with a <strong>Free plan</strong> — no credit
        card required.
      </p>

      <h2>Step 2 — Add your first item</h2>
      <p>
        Navigate to <strong>Items → New item</strong>. Every item needs a name and a SKU (a unique
        identifier like <code>WIDGET-001</code>). You can also add:
      </p>
      <ul>
        <li>A barcode (EAN-13, UPC, Code 128, QR, etc.) for scanner lookup</li>
        <li>A category for grouping</li>
        <li>Cost and sale price for reporting</li>
        <li>A reorder point so the low-stock alert fires when you run low</li>
      </ul>
      <p>On the Free plan you can create up to 100 items. Upgrade to Pro for unlimited items.</p>

      <h2>Step 3 — Set up a warehouse</h2>
      <p>
        Navigate to <strong>Locations → New location</strong>. Give it a name (e.g. &quot;Main
        Warehouse&quot;) and a short code (e.g. &quot;MAIN&quot;). OneAce tracks stock independently per location.
      </p>
      <p>
        The Free plan includes one location. Pro and Business plans include unlimited locations.
      </p>

      <h2>Step 4 — Record your first movement</h2>
      <p>
        Once you have an item and a location, you can record stock. Go to{" "}
        <strong>Movements → Record movement</strong> and choose <strong>Receipt</strong> to bring
        stock in. Select your item, your warehouse, and the quantity received. Click Save.
      </p>
      <p>
        Your item now shows stock on hand. Every movement is permanently recorded in the ledger for
        audit purposes.
      </p>

      <h2>What&apos;s next?</h2>
      <ul>
        <li>
          <Link href="/docs/scanning">Set up barcode scanning</Link> — scan items instead of
          selecting from dropdowns
        </li>
        <li>
          <Link href="/docs/stock-counts">Run a stock count</Link> — verify your on-hand quantities
        </li>
        <li>
          <Link href="/docs/purchase-orders">Create a purchase order</Link> — receive stock from a
          supplier (Pro plan)
        </li>
      </ul>
    </article>
  );
}
