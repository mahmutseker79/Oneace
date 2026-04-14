import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Barcode scanning — OneAce Docs",
  description: "Use barcode scanning in OneAce for fast stock lookups, receiving, and transfers.",
};

export default function ScanningPage() {
  return (
    <article className="prose prose-sm max-w-none dark:prose-invert">
      <h1>Barcode scanning</h1>
      <p className="lead">
        OneAce supports barcode scanning across all major workflows — stock lookups, receiving,
        transfers, and stock counts — using your device camera or a USB/Bluetooth wedge scanner.
      </p>

      <h2>Using the scan page</h2>
      <p>
        Navigate to <strong>Scan</strong> in the sidebar. Tap <strong>Start camera</strong> and hold
        a barcode in the green guide. OneAce detects it automatically using the browser&apos;s
        native BarcodeDetector API (or a ZXing fallback on older browsers).
      </p>
      <p>
        <strong>Continuous scan mode</strong> is on by default. After each successful scan, the
        camera auto-resumes after 1.5 seconds. You can scan 30+ items per minute.
      </p>

      <h2>Keyboard wedge scanners</h2>
      <p>
        USB and Bluetooth wedge scanners work on every scan input in the app — just focus the input
        field and scan. The scanner types the barcode and presses Enter automatically. No camera
        permission needed.
      </p>

      <h2>Unknown barcode quick-add</h2>
      <p>
        If a barcode isn&apos;t recognized, a Quick-add sheet slides up so you can create the item
        immediately and return to scanning — without losing your place.
      </p>

      <h2>Supported barcode formats</h2>
      <p>EAN-13, EAN-8, UPC-A, UPC-E, Code 128, Code 39, QR Code, ITF.</p>

      <h2>Scan-assisted workflows</h2>
      <ul>
        <li>
          <strong>PO receiving</strong> — scan incoming items on a purchase order to auto-fill
          quantities (Pro plan)
        </li>
        <li>
          <strong>Transfer wizard</strong> — scan to add items to a transfer without using dropdowns
          (Pro plan)
        </li>
        <li>
          <strong>Stock counts</strong> — scan items during a count session
        </li>
      </ul>

      <h2>Scan history</h2>
      <p>
        The scan page shows your last 50 scans. Use it to review what you processed in a session.
      </p>

      <h2>Offline scanning</h2>
      <p>
        Barcode lookup works offline using a locally cached item list. Movements triggered by a scan
        queue automatically and sync when you reconnect.
      </p>
    </article>
  );
}
