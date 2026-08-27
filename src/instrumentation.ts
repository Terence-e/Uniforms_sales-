// Server + edge Sentry init (Next 16 instrumentation convention). No-op without
// a DSN. `onRequestError` forwards server-side errors (Server Components, Route
// Handlers, Server Actions) to Sentry, scrubbed by the same beforeSend hook.
import * as Sentry from '@sentry/nextjs';
import { scrubEvent } from '@/lib/sentry-scrub';

export async function register() {
  const runtime = process.env.NEXT_RUNTIME;
  if (runtime !== 'nodejs' && runtime !== 'edge') return;

  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
    beforeSend: (event) => scrubEvent(event),
    beforeSendTransaction: (event) => scrubEvent(event)
  });
}

export const onRequestError = Sentry.captureRequestError;
