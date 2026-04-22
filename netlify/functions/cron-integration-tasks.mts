// Bridge: mirrors vercel.json cron "/api/cron/integration-tasks" @ "*/30 * * * *"
// Drains the Shopify / QuickBooks DLQ worker queue.
import type { Config } from "@netlify/functions";
import { callCronRoute } from "./_cron-bridge.mts";

export default async () => callCronRoute("/api/cron/integration-tasks");

export const config: Config = {
  schedule: "*/30 * * * *", // every 30 minutes
};
