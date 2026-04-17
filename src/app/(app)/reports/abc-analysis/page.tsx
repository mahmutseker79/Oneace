import { getMessages } from "@/lib/i18n";
import { ABCAnalysisClient } from "./abc-analysis-client";

export const metadata = {
  title: "ABC Analysis | OneAce",
  description: "Pareto analysis of your inventory value distribution",
};

export default async function ABCAnalysisPage() {
  const messages = await getMessages();
  const labels = messages.reports.abcAnalysis;

  return <ABCAnalysisClient labels={labels} />;
}
