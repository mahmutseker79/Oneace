import { getMessages } from "@/lib/i18n";
import { VarianceTrendClient } from "./variance-trend-client";

export const metadata = {
  title: "Variance Trend | OneAce",
  description: "Track inventory variance trends over time",
};

export default async function VarianceTrendPage() {
  const messages = await getMessages();
  const labels = messages.reports.varianceTrend;

  return <VarianceTrendClient labels={labels} />;
}
