import { getMessages } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";
import { DepartmentVarianceClient } from "./department-variance-client";

export const metadata = {
  title: "Department Variance | OneAce",
  description: "Variance analysis by department or location",
};

export default async function DepartmentVariancePage() {
  // P1-6 (audit v1.0 §5.11): page-level auth guard. Without this, the
  // route relied on middleware-only cookie presence — a session for a
  // user with no active membership would hit this page body and the
  // client component would issue API requests using the wrong/no org
  // context. `requireActiveMembership` redirects to /login (no session)
  // or /onboarding (session but no org), matching every other report
  // page in this directory.
  await requireActiveMembership();

  const messages = await getMessages();
  const labels = messages.reports.departmentVariance;

  return <DepartmentVarianceClient labels={labels} />;
}
