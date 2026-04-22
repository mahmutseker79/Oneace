// Bridge: mirrors vercel.json cron "/api/cron/vercel-webhook-health" @ "*/30 * * * *"
//
// NOTE: Route name still says "vercel-" — Faz 2 of the Netlify migration
// will rename this to platform-agnostic (audit v1.3 F-01). For Faz 1 POC we
// keep the path identical so route handlers ship unchanged.
import type { Config } from "@netlify/functions";
import { callCronRoute } from "./_cron-bridge.mts";

export default async () => callCronRoute("/api/cron/vercel-webhook-health");

export const config: Config = {
  schedule: "*/30 * * * *", // every 30 minutes
};
