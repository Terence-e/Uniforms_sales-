# Security baseline

The standard web-app security baseline for this project, and how each control was
verified. The guiding rule for the review: framework defaults are usually enough,
but they are **verified, not assumed**.

Stack context: Next.js (App Router) on Vercel, Supabase (Postgres + Auth), React
19. State-changing operations go through Server Actions; the database is guarded
by Row Level Security (see `supabase/policies/`).

## Summary

| Control | Mechanism | Status |
| --- | --- | --- |
| CSRF | Next.js Server Actions (Origin/Host check) | Verified |
| XSS | React JSX auto-escaping; no `dangerouslySetInnerHTML` | Verified |
| SQL injection | Supabase client / parameterized RPCs only | Verified |
| Content-Security-Policy | Set in `next.config.ts` | **Added** |
| Other security headers | Set in `next.config.ts` | **Added** |
| Password hashing | Supabase Auth (bcrypt) | Verified |
| HTTPS / HSTS | Vercel default + explicit HSTS header | Verified |

Only one gap was found — no CSP/security headers were configured. Everything else
was already sound and is documented below so it stays that way.

## CSRF

All 12 mutation modules under `src/actions/*` are `'use server'` Server Actions.
Next.js protects Server Actions out of the box:

- they are POST-only, and Next compares the request `Origin` against the host —
  a cross-origin or forged POST is rejected with `403`;
- the action target is an encrypted, non-guessable action ID, not a stable URL.

No visible CSRF token field is used (or needed) — the Origin check plus the
action-ID indirection is the mechanism.

The one non-Server-Action mutation surface is the webhook route handler
(`src/app/api/webhooks/route.ts`). Route handlers are intentionally exempt from
Server Action CSRF, so it authenticates callers itself: `verifySignature`
currently returns `false`, so the endpoint rejects everything and never touches
the database until the provider's HMAC scheme is wired in. It is closed by
default, not open by default.

**Test**

```bash
# Forge a Server Action POST with a mismatched Origin -> expect 403
curl -i -X POST https://<app>/en/sales \
  -H 'Origin: https://evil.example' -H 'Content-Type: text/plain' --data 'x'
```

## XSS

React escapes all interpolated content in JSX by default, and this codebase never
opts out: a grep for `dangerouslySetInnerHTML` across `src/` returns nothing.
User-entered data (names, notes, measurements) is rendered as text, never as
markup, and never translated.

(`next-themes` uses `dangerouslySetInnerHTML` internally for its static no-flash
theme script inside `node_modules`. That is a fixed, non-user string and is not
part of application code.)

```bash
grep -rn "dangerouslySetInnerHTML" src/    # expected: no matches
```

## SQL injection

Every database call goes through the Supabase client (`.from().select()/insert()`
etc.) or `.rpc()`. No SQL is assembled from strings in application code.

Server-side SQL functions (`record_sale`, `record_order`,
`record_production_batch`, `collect_order_lines`, `next_reference`,
`search_transactions`, …) are parameterized `plpgsql`/`sql` definitions that take
typed arguments — they are not query strings concatenated from user input.

```bash
# No raw SQL construction in app code
grep -rniE "\.sql\`|raw\(|\$\{.*\}.*(select|insert|update|delete) " src/   # expected: no matches
```

## Content-Security-Policy and security headers

**This was the gap.** No headers were configured; they were added in
`next.config.ts` via an `async headers()` block applied to `/:path*`.

### CSP

A deliberate *reasonable baseline*, not a locked nonce-based policy. A strict
`script-src` with per-request nonces requires a middleware to inject them, which
this app does not run. The directives allow the minimum the stack actually uses:

| Directive | Value | Why |
| --- | --- | --- |
| `default-src` | `'self'` | deny by default |
| `script-src` | `'self' 'unsafe-inline'` (+ `'unsafe-eval'` in dev) | Next.js inline bootstrap + next-themes inline script; dev needs eval for Fast Refresh |
| `style-src` | `'self' 'unsafe-inline'` | next/font, Tailwind injected styles, inline `<style>` on print sheets |
| `img-src` | `'self' data: blob: https:` | signature data-URLs, avatar/logo blobs |
| `font-src` | `'self' data:` | self-hosted fonts |
| `connect-src` | `'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io` (+ `ws:` in dev) | Supabase REST + Realtime, Sentry ingest, dev HMR socket |
| `worker-src` | `'self' blob:` | blob-backed web workers |
| `frame-ancestors` | `'none'` | clickjacking |
| `base-uri` / `form-action` | `'self'` | stop injected markup redirecting navigation/form posts off-origin |
| `object-src` | `'none'` | no plugins |

### Other headers

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`

**Test**

```bash
curl -sI https://<app> | grep -iE \
  'content-security-policy|strict-transport|x-frame|x-content-type|referrer|permissions-policy'
```

## Passwords

Handled entirely by Supabase Auth, which hashes with bcrypt. The application uses
`supabase.auth` for sign-in, account creation and password reset, and never
stores, hashes or logs a password itself. Failed sign-ins are rate-limited (see
`countRecentFailedLogins` in `src/lib/audit.ts`).

## HTTPS

Vercel serves the app over HTTPS and redirects HTTP by default. The explicit
`Strict-Transport-Security` header above reinforces this; it is a no-op over
plain HTTP (browsers ignore HSTS on non-HTTPS), so it is safe in local dev.

## Known limitation / future hardening

`script-src 'unsafe-inline'` is the pragmatic baseline; a **nonce-based strict
CSP** would be stronger but needs a root middleware to inject per-request nonces.
Residual XSS risk is already low (JSX escaping + no `dangerouslySetInnerHTML`), so
this is recorded as a future hardening step rather than an open gap.
