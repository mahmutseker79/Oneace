// REMOVED — replaced by netlify/functions/cron-platform-webhook-health.mts
// (Faz 2 rename, v1.5.32-audit-v1.3-platform-agnostic).
//
// This file remains on disk only because the Cowork FUSE sandbox
// refuses unlink(). It is removed from the git index; Netlify's
// Scheduled Functions runtime will never see it in the real build.
//
// Export a no-op with no `config.schedule` so that even if the file
// somehow ships, Netlify does not register a duplicate cron.
export default async () => new Response("gone", { status: 410 });
