import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const isDev = process.env.NODE_ENV === 'development';

// Content-Security-Policy. Deliberately a "reasonable baseline", not a locked
// nonce-based policy: a strict script-src with per-request nonces needs a
// middleware to inject them, which this app does not run. The allowances below
// are the minimum the stack actually uses --
//   * script-src 'unsafe-inline' : Next.js bootstraps with inline scripts and
//     next-themes injects an inline no-flash script. Dev additionally needs
//     'unsafe-eval' for React Fast Refresh.
//   * style-src 'unsafe-inline'  : next/font, Tailwind's injected styles, and the
//     inline <style> blocks on the print sheets.
//   * connect-src                : Supabase REST + Realtime (wss), Sentry ingest,
//     and the dev HMR websocket.
//   * img-src data:/blob:        : signature data-URLs and avatar/logo blobs.
// frame-ancestors 'none' + object-src 'none' shut down clickjacking and plugin
// embedding; base-uri/form-action 'self' keep injected markup from redirecting
// navigation or form posts off-origin.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io${isDev ? ' ws:' : ''}`,
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'"
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  },
  // Vercel also sets HSTS in production; this makes the intent explicit and is a
  // no-op over http (browsers ignore HSTS on non-HTTPS).
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }
];

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb'
    }
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  }
};

export default withNextIntl(nextConfig);
