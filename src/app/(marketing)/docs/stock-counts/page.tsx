import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stock counts — OneAce Docs",
  description: "Run accurate offline stock counts in OneAce with multiple operators.",
};

export default function StockCountsPage() {
  return (
    <article className="prose prose-sm max-w-none dark:prose-invert">
      <h1>Stock counts</h1>
      <p className="lead">
        OneAce supports offline, multi-operator stock counts. Multiple people can count the same
        warehouse simultaneously — conflicts are detected and surfaced for manual resolution.
      </p>

      <h2>Creating a stock count</h2>
      <ol>
        <li>
          Go to <strong>Stock counts → New count</strong>
        </li>
        <li>Select a warehouse (and optionally a bin scope)</li>
        <li>Choose a methodology: Blind (no expected quantities shown) or Visible</li>
        <li>Add participants (team members who will count)</li>
        <li>
          Click <strong>Start count</strong>
        </li>
      </ol>

      <h2>Counting items</h2>
      <p>
        On the count detail page, scan or enter items and their counted quantities. Each entry is
        immediately saved. Multiple operators can enter counts simultaneously — OneAce merges them
        server-side.
      </p>

      <h2>Offline counting</h2>
      <p>
        Once a count is loaded, entries queue locally if you lose connectivity. When you reconnect,
        all queued entries sync automatically. You&apos;ll see a sync indicator in the navigation
        bar.
      </p>

      <h2>Reviewing and reconciling</h2>
      <p>
        After all items are counted, the count moves to <strong>Ready to reconcile</strong>. You see
        a variance report: expected vs. counted quantities, with the difference highlighted. Review
        any discrepancies, then click <strong>Post count</strong> to apply adjustments to your stock
        levels.
      </p>
      <p>
        Every posted count creates a permanent stock adjustment movement in the ledger, tagged with
        the count that generated it.
      </p>

      <h2>Bin-scoped counts</h2>
      <p>
        On Pro and Business plans, you can scope a count to a specific bin or set of bins within a
        warehouse. This is useful for cycle counts — counting one zone at a time.
      </p>
    </article>
  );
}
