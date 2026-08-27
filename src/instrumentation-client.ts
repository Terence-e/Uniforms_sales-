// Client-side Sentry init. Runs before hydration (Next 16 instrumentation-client
// convention). With no NEXT_PUBLIC_SENTRY_DSN set, Sentry.init is a no-op, so the
// app behaves identically when error tracking is switched off.
import * as Sentry from '@sentry/nextjs';
import { scrubEvent } from '@/lib/sentry-scrub';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  sendDefaultPii: false, // never attach IP / cookies / headers automatically
  tracesSampleRate: 0.1,
  beforeSend: (event) => scrubEvent(event),
  beforeSendTransaction: (event) => scrubEvent(event)
});

// Adds navigation breadcrumbs / trace continuity for App Router transitions.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
