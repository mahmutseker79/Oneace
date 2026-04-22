// Bridge: mirrors vercel.json cron "/api/cron/cleanup-migration-files" @ "0 3 * * *"
import type { Config } from "@netlify/functions";
import { callCronRoute } from "./_cron-bridge.mts";

export default async () => callCronRoute("/api/cron/cleanup-migration-files");

export const config: Config = {
  schedule: "0 3 * * *", // daily at 03:00 UTC
};
