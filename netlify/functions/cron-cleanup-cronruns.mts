// Bridge: mirrors vercel.json cron "/api/cron/cleanup-cronruns" @ "0 4 * * *"
import type { Config } from "@netlify/functions";
import { callCronRoute } from "./_cron-bridge.mts";

export default async () => callCronRoute("/api/cron/cleanup-cronruns");

export const config: Config = {
  schedule: "0 4 * * *", // daily at 04:00 UTC
};
