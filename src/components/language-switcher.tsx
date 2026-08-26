'use client';

import { useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing, type Locale } from '@/i18n/routing';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

const LABELS: Record<Locale, string> = {
  en: 'English',
  fr: 'Français'
};

export function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const t = useTranslations('Nav');

  function onChange(next: string) {
    // `pathname` here is already locale-stripped, so the router just re-prefixes.
    startTransition(() => {
      router.replace(pathname, { locale: next as Locale });
    });
  }

  return (
    <Select value={locale} onValueChange={onChange} disabled={isPending}>
      <SelectTrigger size="sm" className="w-[7.5rem]" aria-label={t('language')}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {routing.locales.map((value) => (
          <SelectItem key={value} value={value}>
            {LABELS[value]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
