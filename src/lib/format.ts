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
export function toDateInputValue(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export const SCHOOL = {
  name: process.env.NEXT_PUBLIC_SCHOOL_NAME || 'Fondation Révélation Sainte Thérèse',
  address: process.env.NEXT_PUBLIC_SCHOOL_ADDRESS || '',
  phone: process.env.NEXT_PUBLIC_SCHOOL_PHONE || '',
  /**
   * A-FR-7.8. The school's logo now ships at public/logo.png, so it prints on
   * every document by default; override with NEXT_PUBLIC_SCHOOL_LOGO if needed.
   */
  logo: process.env.NEXT_PUBLIC_SCHOOL_LOGO || '/logo.png'
};
