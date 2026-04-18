import { getMessages } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";
import { CountComparisonClient } from "./count-comparison-client";

export const metadata = {
  title: "Count Comparison | OneAce",
  description: "Compare results between two stock counts to identify discrepancies",
};

export default async function CountComparisonPage() {
  // P1-6 (audit v1.0 §5.11): page-level auth guard — see
  // department-variance/page.tsx for the rationale. Same pattern.
  await requireActiveMembership();

  const messages = await getMessages();
  const labels = messages.reports.countComparison;

  return <CountComparisonClient labels={labels} />;
}
