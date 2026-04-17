import { getMessages } from "@/lib/i18n";
import { CountComparisonClient } from "./count-comparison-client";

export const metadata = {
  title: "Count Comparison | OneAce",
  description: "Compare results between two stock counts to identify discrepancies",
};

export default async function CountComparisonPage() {
  const messages = await getMessages();
  const labels = messages.reports.countComparison;

  return <CountComparisonClient labels={labels} />;
}
