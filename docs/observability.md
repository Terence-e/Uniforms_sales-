# Error tracking (Sentry — Phase 1)

Sentry catches JavaScript crashes, failed API calls, and "the app said it saved
but it didn't" — the failure modes the requirements call out in **A-NFR-3**. The
free tier (5k errors/month) is far more than this app will produce.

> **Phase 1 only.** Phase 2 uses an in-app bug reporter instead (separate issue).
> Do not carry this Sentry wiring into Part B.

## Status

- [x] Env vars declared in `.env.example` (`NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`)
- [x] PII-scrubbing spec agreed (below)
- [ ] Sentry project created + both developers invited — **dashboard task**
- [ ] DSN added to Vercel (Production + Preview) and local `.env.local`
- [ ] SDK installed and wired (see below), build verified on this Next build
- [ ] Test error confirmed in the dashboard with **no PII**

The SDK is intentionally not installed yet: this repo runs a **customised Next
16.3.3**, and `@sentry/nextjs` hooks into the Next build, so it must be added and
then build-verified, not merged blind. Do that once the project exists.

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

## 3. Install and wire

```bash
npm install @sentry/nextjs
npm run build      # verify the customised Next build still succeeds
```

Wire it the App-Router way (no legacy `sentry.*.config.ts`):

- `instrumentation-client.ts` — browser `Sentry.init`
- `instrumentation.ts` — `register()` calls server/edge `Sentry.init`; also
  `export const onRequestError = Sentry.captureRequestError`
- `src/app/global-error.tsx` — reports root-level render crashes

Every `Sentry.init` uses the **same** options object below.

## 4. PII scrubbing (required)

Student names, parent/customer names, phone numbers, and payment
references/amounts must **never** reach Sentry. Two layers:

**a) Turn off automatic PII and scrub events before they send.**

```ts
// lib/sentry-scrub.ts — used by every Sentry.init as { beforeSend, beforeSendTransaction }
const PII_KEYS = [
  'customer_name', 'student_name', 'parent_name', 'name',
  'phone', 'msisdn',
  'payment_reference', 'reference', 'txn', 'amount', 'total', 'subtotal', 'signature_url'
];

// Cameroon phone numbers, and long digit runs that look like references/amounts.
const PHONE = /(\+?237)?[\s-]?\d{9}\b/g;
const LONGNUM = /\b\d{5,}\b/g;

function scrubString(s: string): string {
  return s.replace(PHONE, '[redacted-phone]').replace(LONGNUM, '[redacted-num]');
}

function scrub(value: unknown): unknown {
  if (typeof value === 'string') return scrubString(value);
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = PII_KEYS.includes(k.toLowerCase()) ? '[redacted]' : scrub(v);
    }
    return out;
  }
  return value;
}

export function beforeSend(event) {
  if (event.request) {
    delete event.request.cookies;
    if (event.request.data) event.request.data = scrub(event.request.data);
    if (event.request.query_string) event.request.query_string = scrubString(String(event.request.query_string));
  }
  if (event.message) event.message = scrubString(event.message);
  event.extra = scrub(event.extra);
  event.contexts = scrub(event.contexts);
  // Drop the user's email/IP; keep only the opaque id for correlation.
  if (event.user) event.user = { id: event.user.id };
  return event;
}
```

Init options for all runtimes:

```ts
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  sendDefaultPii: false,          // do not attach IP / headers / cookies
  tracesSampleRate: 0.1,
  beforeSend,
  beforeSendTransaction: beforeSend,
});
```

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
