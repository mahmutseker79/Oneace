// Bridge: mirrors vercel.json cron "/api/cron/stock-count-triggers" @ "0 0 * * *"
import type { Config } from "@netlify/functions";
import { callCronRoute } from "./_cron-bridge.mts";

export default async () => callCronRoute("/api/cron/stock-count-triggers");

export const config: Config = {
  schedule: "0 0 * * *", // daily at 00:00 UTC
};
