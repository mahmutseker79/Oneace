// Bridge: mirrors vercel.json cron "/api/cron/cleanup-notifications" @ "15 3 * * *"
import type { Config } from "@netlify/functions";
import { callCronRoute } from "./_cron-bridge.mts";

export default async () => callCronRoute("/api/cron/cleanup-notifications");

export const config: Config = {
  schedule: "15 3 * * *", // daily at 03:15 UTC
};
