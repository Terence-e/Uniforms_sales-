import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LoginForm } from '@/components/forms/login-form';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { SCHOOL } from '@/lib/format';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ redirectTo?: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Login' });
  return { title: t('title') };
}

export default async function LoginPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { redirectTo } = await searchParams;
  const t = await getTranslations('Login');

  // Only ever accept a same-origin path -- an absolute URL here would turn the
  // login screen into an open redirect.
  const safeRedirect =
    redirectTo?.startsWith('/') && !redirectTo.startsWith('//')
      ? redirectTo
      : null;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <p className="text-sm font-medium text-muted-foreground">
            {SCHOOL.name}
          </p>
          <CardTitle className="text-2xl">{t('title')}</CardTitle>
          <CardDescription>{t('subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm redirectTo={safeRedirect} />
        </CardContent>
      </Card>
    </main>
  );
}
