import type { Event } from '@sentry/nextjs';

/**
 * Strips personally identifiable information out of Sentry events before they
 * leave the process (A-NFR-3, and P-6: user data is never leaked). Student,
 * parent and customer names, phone numbers, and payment references/amounts must
 * never reach Sentry. Two layers protect us: this scrubber, and the rule that
 * such values never go into an Error message or breadcrumb in the first place.
 *
 * Applied from every Sentry.init as both `beforeSend` and `beforeSendTransaction`.
 */

// Object keys whose values are always redacted, whatever they contain.
const PII_KEYS = new Set([
  'customer_name', 'student_name', 'parent_name', 'name', 'full_name',
  'phone', 'msisdn', 'tel',
  'payment_reference', 'reference', 'ref', 'txn', 'transaction',
  'amount', 'total', 'subtotal', 'discount',
  'signature', 'signature_url'
]);

// Cameroon phone numbers, and any long digit run that looks like a reference or
// an amount, wherever they appear inside free-text strings.
const PHONE = /(\+?237[\s-]?)?\d{9}\b/g;
const LONGNUM = /\b\d{5,}\b/g;

function scrubString(s: string): string {
  return s.replace(PHONE, '[redacted-phone]').replace(LONGNUM, '[redacted-num]');
}

function scrub(value: unknown): unknown {
  if (typeof value === 'string') return scrubString(value);
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = PII_KEYS.has(k.toLowerCase()) ? '[redacted]' : scrub(v);
    }
    return out;
  }
  return value;
}

/** Redacts PII in place and returns the same event (so the type is preserved). */
export function scrubEvent<T extends Event>(event: T): T {
  if (event.request) {
    // Cookies and headers can carry the session and the user's IP -- drop them.
    delete event.request.cookies;
    delete event.request.headers;
    if (event.request.data !== undefined) {
      event.request.data = scrub(event.request.data);
    }
    if (typeof event.request.query_string === 'string') {
      event.request.query_string = scrubString(event.request.query_string);
    }
  }

  if (event.message) event.message = scrubString(event.message);

  for (const ex of event.exception?.values ?? []) {
    if (ex.value) ex.value = scrubString(ex.value);
  }

  for (const b of event.breadcrumbs ?? []) {
    if (b.message) b.message = scrubString(b.message);
    if (b.data) b.data = scrub(b.data) as Record<string, unknown>;
  }

  if (event.extra) event.extra = scrub(event.extra) as Record<string, unknown>;
  if (event.contexts) event.contexts = scrub(event.contexts) as typeof event.contexts;

  // Keep only an opaque id for correlation; never email, username or IP.
  if (event.user) event.user = event.user.id ? { id: event.user.id } : {};

  return event;
}
