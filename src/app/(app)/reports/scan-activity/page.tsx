/**
 * Scan Activity Report (P9.3e) — server-component shell.
 *
 * The actual UI lives in `scan-activity-client.tsx` because it reads
 * the local Dexie/localStorage scan history. The shell exists so we
 * can run a `requireActiveMembership()` server-side check before the
 * client component is shipped to the browser — see audit v1.0 §5.11
 * (P1-6). Even though no server-side data is fetched here, gating the
 * page route keeps users without an active org membership out of the
 * UI (matches every other report page in this directory).
 */

import { requireActiveMembership } from "@/lib/session";
import { ScanActivityClient } from "./scan-activity-client";

export const metadata = {
  title: "Scan Activity | OneAce",
  description: "Recent barcode scans and their results",
};

export default async function ScanActivityReportPage() {
  await requireActiveMembership();
  return <ScanActivityClient />;
}
