import { getMessages } from "@/lib/i18n";
import { DepartmentVarianceClient } from "./department-variance-client";

export const metadata = {
  title: "Department Variance | OneAce",
  description: "Variance analysis by department or location",
};

export default async function DepartmentVariancePage() {
  const messages = await getMessages();
  const labels = messages.reports.departmentVariance;

  return <DepartmentVarianceClient labels={labels} />;
}
