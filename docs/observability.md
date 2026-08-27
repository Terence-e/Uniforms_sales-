# Error tracking (Sentry — Phase 1)

Sentry catches JavaScript crashes, failed API calls, and "the app said it saved
but it didn't" — the failure modes the requirements call out in **A-NFR-3**. The
free tier (5k errors/month) is far more than this app will produce.

> **Phase 1 only.** Phase 2 uses an in-app bug reporter instead (separate issue).
> Do not carry this Sentry wiring into Part B.

## Status

- [x] Env vars declared in `.env.example` (`NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`)
- [x] PII-scrubbing implemented (`src/lib/sentry-scrub.ts`)
- [x] SDK installed (`@sentry/nextjs`) and wired; `npm run build` verified green
- [ ] Sentry project created + both developers invited — **dashboard task**
- [ ] DSN added to Vercel (Production + Preview) and local `.env.local`
- [ ] Test error confirmed in the dashboard with **no PII**

The SDK is wired but **dormant until a DSN is set** — `Sentry.init` with no DSN is
a no-op, so the app runs identically until you add `NEXT_PUBLIC_SENTRY_DSN`. The
`withSentryConfig` build plugin (source-map upload, tunnelling) was intentionally
left off to keep the customised Next 16.3.3 build untouched; add it later if you
want uploaded source maps.

## 1. Create the project (dashboard)

1. Create a free Sentry project, platform **Next.js**.
2. Copy the **DSN** (Settings → Client Keys). The DSN is public by design.
3. Invite **both developers** to the Sentry org/project.

## 2. Add the DSN

- Local: put `NEXT_PUBLIC_SENTRY_DSN=...` in `.env.local`.
- Vercel: add `NEXT_PUBLIC_SENTRY_DSN` to **Production** and **Preview**
  (and `SENTRY_AUTH_TOKEN` for source-map upload — server-only). See
  [`docs/secrets.md`](secrets.md).

With no DSN set, the SDK is a no-op, so the app runs identically when Sentry is
off.

## 3. Install and wire — done

`@sentry/nextjs` is installed and wired the App-Router way (no legacy
`sentry.*.config.ts`), verified with `npm run build`:

- `src/instrumentation-client.ts` — browser `Sentry.init` + `onRouterTransitionStart`
- `src/instrumentation.ts` — `register()` runs server/edge `Sentry.init`; also
  `export const onRequestError = Sentry.captureRequestError`
- `src/app/global-error.tsx` — reports root-layout crashes to Sentry
- `src/lib/sentry-scrub.ts` — the PII scrubber wired into every init

Every `Sentry.init` passes `sendDefaultPii: false` plus the same
`beforeSend`/`beforeSendTransaction` scrubber described below.

## 4. PII scrubbing (required)

Student names, parent/customer names, phone numbers, and payment
references/amounts must **never** reach Sentry. Two layers:

**a) Turn off automatic PII and scrub events before they send.** Implemented in
[`src/lib/sentry-scrub.ts`](../src/lib/sentry-scrub.ts) and wired into every
`Sentry.init` as `beforeSend`/`beforeSendTransaction`, alongside
`sendDefaultPii: false`. It:

- redacts values under PII keys (`customer_name`, `student_name`, `parent_name`,
  `name`, `phone`, `payment_reference`, `amount`, `total`, `signature_url`, …);
- rewrites Cameroon phone numbers and long digit runs (references/amounts) inside
  free-text — error messages, exception values and breadcrumbs included;
- drops `request.cookies`/`request.headers` and reduces `user` to an opaque `id`.

Edit the deny-list / patterns in that one file if new PII fields appear.

**b) Don't create the PII in the first place.** Never put a customer/student
name, phone, or amount into an `Error` message or a Sentry breadcrumb/tag. Log
IDs (`sale.id`, `receipt_no` is fine — it is not personal), not people.

## 5. Verify (acceptance)

1. Add a throwaway route/button that does `throw new Error('sentry smoke test ' + Date.now())`.
2. Trigger it; confirm the event lands in the Sentry dashboard.
3. Open the event JSON and confirm it contains **no** student name, parent/customer
   name, phone number, or transaction amount. Test with a real-looking sale in the
   form first, so the scrubber is exercised against actual field names.
4. Remove the throwaway trigger.
5. Confirm **both developers** can log in to Sentry and see the event.
