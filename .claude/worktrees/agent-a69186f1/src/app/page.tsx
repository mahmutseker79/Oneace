import { getCurrentSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function RootPage() {
  const session = await getCurrentSession();
  if (session) {
    redirect("/dashboard");
  }
  redirect("/login");
}
