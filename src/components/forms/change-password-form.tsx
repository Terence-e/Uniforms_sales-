'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { EyeIcon, EyeOffIcon, LockKeyholeIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { changePassword } from '@/actions/auth';
import { passwordScore } from '@/lib/validation/auth-schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

type FieldErrors = { current?: string; password?: string; confirm?: string };

export function ChangePasswordForm({
  redirectOnSuccess = true,
  onSuccess
}: {
  /** After a successful change, navigate to the dashboard (first-login flow). */
  redirectOnSuccess?: boolean;
  /** Called after success instead of navigating (inline profile use). */
  onSuccess?: () => void;
}) {
  const t = useTranslations('ChangePassword');
  const tv = useTranslations('Validation');
  const router = useRouter();

  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  const score = passwordScore(password);
  const strengthLabel = ['', t('strengthWeak'), t('strengthFair'), t('strengthStrong')][score];

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setPending(true);
    const res = await changePassword({ current, password, confirm });
    setPending(false);

    if (res.ok) {
      toast.success(t('success'));
      if (redirectOnSuccess) {
        router.replace('/dashboard');
        router.refresh();
      } else {
        setCurrent('');
        setPassword('');
        setConfirm('');
        onSuccess?.();
        router.refresh();
      }
      return;
    }
    if (res.fieldErrors) setErrors(res.fieldErrors);
    else toast.error(t('error'));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {/* Hidden username field: lets browsers/password managers associate the new
          password with the account, and clears the a11y warning. */}
      <input
        suppressHydrationWarning
        type="text"
        name="username"
        autoComplete="username"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        readOnly
      />

      <div className="space-y-1.5">
        <Label htmlFor="current">{t('currentPassword')}</Label>
        <div className="relative">
          <LockKeyholeIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="current"
            type={show ? 'text' : 'password'}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            className="pl-9 pr-9"
            aria-invalid={Boolean(errors.current)}
          />
          <button
            suppressHydrationWarning
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
            aria-label={show ? t('hide') : t('show')}
          >
            {show ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
          </button>
        </div>
        {errors.current && <p className="text-sm text-destructive">{tv(errors.current)}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">{t('newPassword')}</Label>
        <div className="relative">
          <LockKeyholeIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="password"
            type={show ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            className="pl-9"
            aria-invalid={Boolean(errors.password)}
          />
        </div>
        {password && (
          <div className="flex items-center gap-2 pt-1">
            <div className="flex flex-1 gap-1">
              {[1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={cn(
                    'h-1 flex-1 rounded-full',
                    i <= score
                      ? score >= 3
                        ? 'bg-emerald-500'
                        : score === 2
                          ? 'bg-amber-500'
                          : 'bg-destructive'
                      : 'bg-muted'
                  )}
                />
              ))}
            </div>
            <span className="text-xs text-muted-foreground">{strengthLabel}</span>
          </div>
        )}
        {errors.password ? (
          <p className="text-sm text-destructive">{tv(errors.password)}</p>
        ) : (
          <p className="text-xs text-muted-foreground">{t('hint')}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirm">{t('confirmPassword')}</Label>
        <div className="relative">
          <LockKeyholeIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="confirm"
            type={show ? 'text' : 'password'}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            className="pl-9"
            aria-invalid={Boolean(errors.confirm)}
          />
        </div>
        {errors.confirm && <p className="text-sm text-destructive">{tv(errors.confirm)}</p>}
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
