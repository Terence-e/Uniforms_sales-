import { KeyRoundIcon } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { signOut } from '@/actions/auth';
import { AuthShell } from '@/components/auth/auth-shell';
import { ChangePasswordForm } from '@/components/forms/change-password-form';
import { Button } from '@/components/ui/button';

// Per-user, auth-gated screen -- never prerender it (also keeps the change-password
// server action from being attached to a static route).
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'ChangePassword' });
  return { title: t('title') };
}

export default async function ChangePasswordPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, tNav] = await Promise.all([
    getTranslations('ChangePassword'),
    getTranslations('Nav')
  ]);

  return (
    <AuthShell
      topRight={
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="sm">
            {tNav('signOut')}
          </Button>
        </form>
      }
    >
      <div className="w-full max-w-md rounded-2xl border bg-card p-7 shadow-xl sm:p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-primary/10 ring-1 ring-border">
            <KeyRoundIcon className="size-7 text-primary" />
          </span>
          <h1 className="text-xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>

        <div className="mt-7">
          <ChangePasswordForm />
        </div>
      </div>
    </AuthShell>
  );
}
