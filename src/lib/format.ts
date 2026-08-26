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
    dateStyle: 'medium'
  }).format(new Date(value));
}

export function formatDateTime(value: string | Date, locale: string = 'en'): string {
  return new Intl.DateTimeFormat(tagFor(locale), {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

/** `YYYY-MM-DD`, for date inputs and file names. */
export function toDateInputValue(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export const SCHOOL = {
  name: process.env.NEXT_PUBLIC_SCHOOL_NAME || 'School Uniform Shop',
  address: process.env.NEXT_PUBLIC_SCHOOL_ADDRESS || '',
  phone: process.env.NEXT_PUBLIC_SCHOOL_PHONE || ''
};
