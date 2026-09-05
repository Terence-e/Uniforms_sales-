import type { Locale } from '@/i18n/routing';

export const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY || 'XAF';

const LOCALE_TAGS: Record<Locale, string> = {
  en: 'en-GB',
  fr: 'fr-FR'
};

function tagFor(locale: string): string {
  return LOCALE_TAGS[locale as Locale] ?? locale;
}

/**
 * Pin every date/time render to the school's zone so the server (usually UTC)
 * and the browser (the visitor's local zone) produce the *same* string --
 * otherwise `Intl` uses each runtime's own zone and hydration mismatches.
 * Matches the `timeZone` already configured for next-intl in `i18n/request.ts`.
 */
export const TIME_ZONE = 'Africa/Douala';

/**
 * XAF has no minor unit, so `Intl` already renders it without decimals. Other
 * currencies keep their own default -- don't hard-code 0 fraction digits here.
 */
export function formatMoney(amount: number, locale: string = 'en'): string {
  return new Intl.NumberFormat(tagFor(locale), {
    style: 'currency',
    currency: CURRENCY
  }).format(amount);
}

export function formatDate(value: string | Date, locale: string = 'en'): string {
  return new Intl.DateTimeFormat(tagFor(locale), {
    dateStyle: 'medium',
    timeZone: TIME_ZONE
  }).format(new Date(value));
}

export function formatDateTime(value: string | Date, locale: string = 'en'): string {
  return new Intl.DateTimeFormat(tagFor(locale), {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: TIME_ZONE
  }).format(new Date(value));
}

/** `YYYY-MM-DD`, for date inputs and file names. */
/**
 * A date as YYYY-MM-DD in LOCAL time. Deliberately not `toISOString().slice(0,10)`:
 * that converts to UTC first, so in a timezone ahead of UTC (the school is at
 * UTC+1) local midnight on the 1st becomes 23:00 on the previous day and the
 * date comes out a day early -- which made "this month" start on the last day of
 * the previous month.
 */
export function toDateInputValue(value: Date): string {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** First day of the month containing `value`, as YYYY-MM-DD (local). */
export function startOfMonth(value: Date): string {
  return toDateInputValue(new Date(value.getFullYear(), value.getMonth(), 1));
}

/**
 * Last day of the month containing `value`, as YYYY-MM-DD (local). Day 0 of the
 * next month is the last day of this one, so this is correct for 28/29/30/31.
 */
export function endOfMonth(value: Date): string {
  return toDateInputValue(new Date(value.getFullYear(), value.getMonth() + 1, 0));
}

export const SCHOOL = {
  name: process.env.NEXT_PUBLIC_SCHOOL_NAME || 'Fondation Révélation Sainte Thérèse',
  address: process.env.NEXT_PUBLIC_SCHOOL_ADDRESS || '',
  phone: process.env.NEXT_PUBLIC_SCHOOL_PHONE || '',
  /**
   * Optional (A-FR-7.8). No logo ships with the repo, and a receipt printing a
   * broken image is worse than one printing the school's name alone -- so this
   * is empty until someone drops a file in public/ and points this at it.
   */
  logo: process.env.NEXT_PUBLIC_SCHOOL_LOGO || ''
};
