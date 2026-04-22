// Bridge: mirrors vercel.json cron "/api/cron/platform-webhook-health" @ "*/30 * * * *"
//
// Faz 2 (audit v1.3 F-01) — renamed from cron-vercel-webhook-health.mts.
// The route itself is now platform-agnostic (reads GitHub main HEAD + prod
// /api/health; emits `platform-webhook.*` log tags). This bridge just
// forwards the schedule tick to that route with the CRON_SECRET bearer.
import type { Config } from "@netlify/functions";
import { callCronRoute } from "./_cron-bridge.mts";

export default async () => callCronRoute("/api/cron/platform-webhook-health");

export const config: Config = {
  schedule: "*/30 * * * *", // every 30 minutes
};
