import { LockIcon } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { AuthShell } from '@/components/auth/auth-shell';
import { ForgotPasswordForm } from '@/components/forms/forgot-password-form';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'ForgotPassword' });
  return { title: t('title') };
}

export default async function ForgotPasswordPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, ta] = await Promise.all([
    getTranslations('ForgotPassword'),
    getTranslations('Auth')
  ]);

  return (
    <AuthShell
      topRight={
        <p className="text-sm text-muted-foreground">
          {ta('haveAccount')}{' '}
          <Link href="/login" className="font-semibold text-foreground underline underline-offset-2">
            {ta('login')}
          </Link>
        </p>
      }
    >
      <div className="w-full max-w-md rounded-2xl border bg-card p-7 shadow-xl sm:p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-muted ring-1 ring-border">
            <LockIcon className="size-7 text-muted-foreground" />
          </span>
          <h1 className="text-xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>

        <div className="mt-7">
          <ForgotPasswordForm />
        </div>
      </div>
    </AuthShell>
  );
}
