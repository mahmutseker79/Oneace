import { getMessages } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";
import { VarianceTrendClient } from "./variance-trend-client";

export const metadata = {
  title: "Variance Trend | OneAce",
  description: "Track inventory variance trends over time",
};

export default async function VarianceTrendPage() {
  // P1-6 (audit v1.0 §5.11): page-level auth guard — see
  // department-variance/page.tsx for the rationale. Same pattern.
  await requireActiveMembership();

  const messages = await getMessages();
  const labels = messages.reports.varianceTrend;

  return <VarianceTrendClient labels={labels} />;
}
