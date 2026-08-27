'use client'; // error boundaries must be Client Components

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

// Last-resort boundary for crashes in the root layout itself, which the
// per-locale error.tsx cannot catch. It renders its own <html>/<body> and has no
// access to global styles or locale, so the copy is intentionally minimal and
// neutral. `retry` (not `reset`) is this Next build's prop name.
export default function GlobalError({
  error,
  retry
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif'
        }}
      >
        <div style={{ textAlign: 'center', padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>
            Something went wrong. / Une erreur est survenue.
          </h2>
          <button
            onClick={() => retry()}
            style={{ marginTop: '1rem', padding: '0.5rem 1rem', cursor: 'pointer' }}
          >
            Try again / Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}
