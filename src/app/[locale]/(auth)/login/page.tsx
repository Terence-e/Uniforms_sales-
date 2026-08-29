import { UserRoundIcon } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AuthShell } from '@/components/auth/auth-shell';
import { LoginForm } from '@/components/forms/login-form';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ redirectTo?: string; expired?: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Login' });
  return { title: t('title') };
}

export default async function LoginPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { redirectTo, expired } = await searchParams;
  const t = await getTranslations('Login');

  // Only ever accept a same-origin path -- an absolute URL here would turn the
  // login screen into an open redirect.
  const safeRedirect =
    redirectTo?.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : null;

  return (
    <AuthShell>
      <div className="w-full max-w-md rounded-2xl border bg-card p-7 shadow-xl sm:p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-muted ring-1 ring-border">
            <UserRoundIcon className="size-7 text-muted-foreground" />
          </span>
          <h1 className="text-xl font-semibold tracking-tight">{t('heading')}</h1>
        </div>

        {expired && (
          <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-center text-sm text-amber-700 dark:text-amber-400">
            {t('sessionExpired')}
          </div>
        )}

        <div className="mt-7">
          <LoginForm redirectTo={safeRedirect} />
        </div>
      </div>
    </AuthShell>
  );
}
