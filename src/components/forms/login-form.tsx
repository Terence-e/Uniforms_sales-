'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { AtSignIcon, EyeIcon, EyeOffIcon, LockKeyholeIcon } from 'lucide-react';
import { signIn } from '@/actions/auth';
import { emptyLoginState } from '@/lib/validation/auth-schema';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { SchoolLogo } from '@/components/brand/school-logo';

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

/**
 * Post-login splash: once the form is submitting, a full-screen logo takes over
 * until the redirect to the dashboard lands. A successful sign-in keeps the
 * action pending through the navigation, so the branded screen covers the whole
 * gap (well under 5s); a failure clears it and shows the error instead.
 */
function LoginSplash() {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <SchoolLogo size="lg" className="animate-logo-blink" />
    </div>
  );
}

export function LoginForm({ redirectTo }: { redirectTo: string | null }) {
  const t = useTranslations('Login');
  const tv = useTranslations('Validation');
  const [state, formAction] = useActionState(signIn, emptyLoginState);
  // The eye toggle is pure client state, independent of the field's value and of
  // any submit/pending state -- so it is always clickable, even on an empty field
  // or the instant the page loads.
  const [showPassword, setShowPassword] = useState(false);

  // Surface the general auth error as an in-app toast (field errors stay inline).
  useEffect(() => {
    if (!state.error) return;
    const message =
      state.error === 'invalidCredentials'
        ? t('invalidCredentials')
        : state.error === 'tooManyAttempts'
          ? t('tooManyAttempts')
          : t('unexpectedError');
    toast.error(message);
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
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder={t('password')}
            required
            className="pl-9 pr-9"
            aria-invalid={Boolean(state.fieldErrors.password)}
            aria-describedby={state.fieldErrors.password ? 'password-error' : undefined}
          />
          <button
            suppressHydrationWarning
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
            aria-label={showPassword ? t('hide') : t('show')}
          >
            {showPassword ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
          </button>
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
      <LoginSplash />
    </form>
  );
}
