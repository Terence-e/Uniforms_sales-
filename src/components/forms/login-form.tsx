'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { AtSignIcon, LockKeyholeIcon } from 'lucide-react';
import { signIn } from '@/actions/auth';
import { emptyLoginState } from '@/lib/validation/auth-schema';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useTranslations('Login');

  return (
    <Button type="submit" className="w-full gap-2" disabled={pending}>
      {pending && (
        <Spinner className="size-4 border-primary-foreground/40 border-t-primary-foreground" />
      )}
      {pending ? t('submitting') : t('submit')}
    </Button>
  );
}

export function LoginForm({ redirectTo }: { redirectTo: string | null }) {
  const t = useTranslations('Login');
  const tv = useTranslations('Validation');
  const [state, formAction] = useActionState(signIn, emptyLoginState);

  // Surface the general auth error as an in-app toast (field errors stay inline).
  useEffect(() => {
    if (state.error) {
      toast.error(
        state.error === 'invalidCredentials'
          ? t('invalidCredentials')
          : t('unexpectedError')
      );
    }
  }, [state, t]);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {redirectTo ? <input type="hidden" name="redirectTo" value={redirectTo} /> : null}

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
            aria-invalid={Boolean(state.fieldErrors.email)}
            aria-describedby={state.fieldErrors.email ? 'email-error' : undefined}
          />
        </div>
        {state.fieldErrors.email ? (
          <p id="email-error" className="text-sm text-destructive">
            {tv('required')}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">{t('password')}</Label>
        <div className="relative">
          <LockKeyholeIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder={t('password')}
            required
            className="pl-9"
            aria-invalid={Boolean(state.fieldErrors.password)}
            aria-describedby={state.fieldErrors.password ? 'password-error' : undefined}
          />
        </div>
        {state.fieldErrors.password ? (
          <p id="password-error" className="text-sm text-destructive">
            {tv('required')}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox name="remember" value="1" />
          {t('rememberMe')}
        </label>
        <Link
          href="/forgot-password"
          className="text-sm font-medium text-primary hover:underline"
        >
          {t('forgotPassword')}
        </Link>
      </div>

      <SubmitButton />
    </form>
  );
}
