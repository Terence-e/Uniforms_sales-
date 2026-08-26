'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

export default function LocaleError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('Errors');

  useEffect(() => {
    // Replace with your error reporter. The digest is the only handle you get
    // on a server error in production -- the message itself is redacted.
    console.error('[uniform-app]', error.digest ?? '', error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <p className="text-muted-foreground">{t('description')}</p>
      {error.digest ? (
        <code className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
          {error.digest}
        </code>
      ) : null}
      <Button onClick={reset}>{t('retry')}</Button>
    </main>
  );
}
