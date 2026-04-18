import { getMessages } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";
import { ABCAnalysisClient } from "./abc-analysis-client";

export const metadata = {
  title: "ABC Analysis | OneAce",
  description: "Pareto analysis of your inventory value distribution",
};

export default async function ABCAnalysisPage() {
  // P1-6 (audit v1.0 §5.11): page-level auth guard — see
  // department-variance/page.tsx for the rationale. The classifier
  // mutation behind this page is gated by `reports.abcClassify`, but
  // that's a server-action check; viewing the page must still require
  // an active membership so a logged-in user with no org is bounced
  // to /onboarding instead of seeing a broken UI.
  await requireActiveMembership();

  const messages = await getMessages();
  const labels = messages.reports.abcAnalysis;

  return <ABCAnalysisClient labels={labels} />;
}
