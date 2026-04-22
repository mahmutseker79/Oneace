// Bridge: mirrors vercel.json cron "/api/cron/vercel-quota-health" @ "*/30 * * * *"
//
// NOTE: Route currently calls Vercel's API directly (VERCEL_TOKEN +
// VERCEL_PROJECT_ID). On Netlify this will return a degraded status until
// Faz 2 (audit v1.3 F-04) swaps to a platform-dispatched implementation
// that can also query Netlify's Functions/Minutes API.
import type { Config } from "@netlify/functions";
import { callCronRoute } from "./_cron-bridge.mts";

export default async () => callCronRoute("/api/cron/vercel-quota-health");

export const config: Config = {
  schedule: "*/30 * * * *", // every 30 minutes
};
