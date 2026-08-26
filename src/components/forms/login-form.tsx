'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';
import { signIn } from '@/actions/auth';
import { emptyLoginState } from '@/lib/validation/auth-schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useTranslations('Login');

  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? t('submitting') : t('submit')}
    </Button>
  );
}

export function LoginForm({ redirectTo }: { redirectTo: string | null }) {
  const t = useTranslations('Login');
  const tv = useTranslations('Validation');
  const [state, formAction] = useActionState(signIn, emptyLoginState);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {redirectTo ? (
        <input type="hidden" name="redirectTo" value={redirectTo} />
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="email">{t('email')}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          placeholder={t('emailPlaceholder')}
          required
          aria-invalid={Boolean(state.fieldErrors.email)}
          aria-describedby={state.fieldErrors.email ? 'email-error' : undefined}
        />
        {state.fieldErrors.email ? (
          <p id="email-error" className="text-sm text-destructive">
            {tv('required')}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">{t('password')}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(state.fieldErrors.password)}
          aria-describedby={
            state.fieldErrors.password ? 'password-error' : undefined
          }
        />
        {state.fieldErrors.password ? (
          <p id="password-error" className="text-sm text-destructive">
            {tv('required')}
          </p>
        ) : null}
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error === 'invalidCredentials'
            ? t('invalidCredentials')
            : t('unexpectedError')}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
