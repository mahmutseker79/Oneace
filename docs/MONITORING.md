# Monitoring & Error Tracking

This guide covers setting up error tracking with Sentry and product analytics with PostHog for OneAce.

## Sentry Error Tracking Setup

Sentry captures unhandled errors from your browser, server, API routes, and middleware. Follow these steps to activate error tracking:

### 1. Create a Sentry Project

1. Go to [sentry.io](https://sentry.io) and sign in (or create an account)
2. Create a new project with platform **Next.js**
3. Copy your **DSN** (looks like `https://xxxxx@xxxxx.ingest.sentry.io/xxxxx`)

### 2. Configure Environment Variables in Vercel

Add the following to your Vercel project settings (Settings → Environment Variables):

```
NEXT_PUBLIC_SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/xxxxx
SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/xxxxx
SENTRY_AUTH_TOKEN=<optional, for source maps>
```

- `NEXT_PUBLIC_SENTRY_DSN` — used by client-side error tracking
- `SENTRY_DSN` — used by server and API error tracking
- `SENTRY_AUTH_TOKEN` — (optional) enables automatic source map uploads to Sentry

### 3. Deploy and Verify

1. Redeploy your application: `vercel deploy --prod`
2. Trigger a test error in your app (or check Console → Error Capture in Sentry)
3. Visit Sentry Dashboard → Issues to confirm errors are appearing

---

## What's Already Configured

OneAce has Sentry fully integrated across all environments:

### Browser Error Tracking
**File:** `sentry.client.config.ts`
- Captures client-side JavaScript errors
- Tracks React component errors via Error Boundary
- Monitors unhandled promise rejections
- Includes session replay (optional)

### Server & API Error Tracking
**File:** `sentry.server.config.ts`
- Captures server-side errors in API routes
- Logs server-side rendering (SSR) errors
- Includes performance monitoring
- Tracing for slow requests

### Middleware Error Tracking
**File:** `sentry.edge.config.ts`
- Captures errors in Next.js middleware
- Tracks request context (headers, cookies, etc.)
- Monitors rate limiting and authentication failures

### React Error Boundary
**File:** `app/global-error.tsx`
- Catches uncaught React component errors
- Logs to Sentry with component stack
- Shows user-friendly error UI

### Content Security Policy (CSP)
The app's CSP headers allow Sentry:
- `connect-src` includes `sentry.io` domains
- `script-src` allows Sentry SDK loading
- No changes needed — CSP is pre-configured

---

## Vercel + Sentry Integration

### Automatic Source Maps Upload

When you deploy to Vercel with `SENTRY_AUTH_TOKEN` set:
1. Vercel automatically builds your Next.js app with source maps
2. The build process uploads source maps to Sentry
3. Sentry uses maps to show original source code in error stack traces

This enables seeing your actual code (not minified) in Sentry's issue details.

### Connecting Vercel Dashboard to Sentry

1. Go to Sentry → Settings → Integrations → Vercel
2. Click "Add Integration"
3. Grant Sentry access to your Vercel projects
4. Select the OneAce project to link

Benefits:
- See deployment info in Sentry issues
- Link back to your Vercel deployments
- Auto-mark issues as resolved on redeploy

---

## Setting Up Alerts

Configure these Sentry alerts to catch critical issues early:

### Alert 1: New Error Spike
When a new error type appears or error frequency spikes:
- Sentry → Alerts → Create Alert Rule
- **Condition:** `error.type is new` OR `frequency >= 10 per minute`
- **Action:** Send to Slack/Email

### Alert 2: High Error Rate
When error rate exceeds 1% of requests:
- **Condition:** `error_count / request_count >= 0.01`
- **Action:** Page on-call engineer via Slack/PagerDuty

### Alert 3: Performance Degradation
When API response times exceed 3 seconds (p95):
- **Condition:** `transaction.duration >= 3000 ms` (p95)
- **Action:** Notify #infrastructure Slack channel

### Alert 4: Unhandled Promise Rejections
When unhandled promise rejections occur:
- **Condition:** `error.type = "UnhandledPromiseRejection"`
- **Action:** Email team lead

---

## PostHog Product Analytics

PostHog is configured for product analytics, funnel tracking, and session replay. It captures:
- Page views and user journeys
- Feature usage and funnel conversions
- Session recordings (optional)
- Custom events

### Enable PostHog Analytics

1. Create a PostHog project at [posthog.com](https://posthog.com)
2. Copy your API key
3. Add to Vercel environment variables:
   ```
   NEXT_PUBLIC_POSTHOG_KEY=phc_xxxxx...
   NEXT_PUBLIC_POSTHOG_HOST=https://us.posthog.com
   ```
4. Redeploy: `vercel deploy --prod`

### PostHog Configuration
**Files:**
- `lib/posthog.client.ts` — Client-side analytics
- `lib/posthog.server.ts` — Server-side event tracking

The client-side SDK automatically tracks:
- Page navigation
- User identification
- Custom events you trigger in your code

Example of tracking a custom event:
```typescript
import { usePostHog } from 'posthog-js/react'

export function MyComponent() {
  const posthog = usePostHog()
  
  const handleClick = () => {
    posthog.capture('button_clicked', {
      button_name: 'signup',
      timestamp: new Date(),
    })
  }
  
  return <button onClick={handleClick}>Sign Up</button>
}
```

### Use Cases
- **Funnels:** Track conversion from signup → onboarding → first report
- **Session Replay:** Understand how users interact with reports
- **Feature Adoption:** Measure who's using new features
- **Performance:** Identify slow pages and features users avoid

---

## Monitoring Dashboard

Access your monitoring data:
- **Errors:** https://sentry.io/organizations/yourorg/issues/
- **Performance:** https://sentry.io/organizations/yourorg/performance/
- **Analytics:** https://app.posthog.com/

## Troubleshooting

### Errors Not Appearing in Sentry
1. Check `NEXT_PUBLIC_SENTRY_DSN` is set in Vercel
2. Verify DSN is correct (copy from Sentry settings)
3. Check browser console for Sentry SDK errors
4. Ensure CSP headers aren't blocking sentry.io

### Source Maps Not Uploading
1. Verify `SENTRY_AUTH_TOKEN` is set in Vercel
2. Check Sentry → Settings → Auth Tokens for valid token
3. Review Vercel build logs for upload errors

### PostHog Events Not Captured
1. Verify `NEXT_PUBLIC_POSTHOG_KEY` is set
2. Check Network tab in DevTools for `posthog.com` requests
3. Ensure PostHog SDK is loaded (check `window.posthog`)

