// Bridge: mirrors vercel.json cron "/api/cron/platform-quota-health" @ "*/30 * * * *"
//
// Faz 2 (audit v1.3 F-04) — renamed from cron-vercel-quota-health.mts.
// The route now dispatches through `src/lib/hosting-platform`, so on
// Vercel it reads deploy-counts and on Netlify it sums build-minutes.
// Either way the alarm policy (80% / 100% of ceiling) is identical.
import type { Config } from "@netlify/functions";
import { callCronRoute } from "./_cron-bridge.mts";

export default async () => callCronRoute("/api/cron/platform-quota-health");

export const config: Config = {
  schedule: "*/30 * * * *", // every 30 minutes
};
