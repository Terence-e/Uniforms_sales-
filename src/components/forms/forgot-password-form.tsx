'use client';

import { useState } from 'react';
import { AtSignIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { requestPasswordReset } from '@/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';

export function ForgotPasswordForm() {
  const t = useTranslations('ForgotPassword');
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const email = String(new FormData(form).get('email') ?? '').trim();
    if (!email.includes('@')) {
      toast.error(t('invalidEmail'));
      return;
    }
    setPending(true);
    // Per A-FR-3.5 there is no self-service email reset: this notifies every Super
    // Admin in-app so they can issue a temporary password. The response is the
    // same whether or not the address exists (no account enumeration).
    await requestPasswordReset(email);
    setPending(false);
    toast.success(t('success'));
    form.reset();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="email">{t('email')}</Label>
        <div className="relative">
          <AtSignIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            placeholder={t('emailPlaceholder')}
            required
            className="pl-9"
          />
        </div>
      </div>

      <Button type="submit" className="w-full gap-2" disabled={pending}>
        {pending && (
          <Spinner className="size-4 border-primary-foreground/40 border-t-primary-foreground" />
        )}
        {pending ? t('submitting') : t('submit')}
      </Button>
    </form>
  );
}
