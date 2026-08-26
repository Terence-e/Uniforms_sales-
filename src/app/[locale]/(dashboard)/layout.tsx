import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getProfile, signOut } from '@/actions/auth';
import { LanguageSwitcher } from '@/components/language-switcher';
import { NavLink } from '@/components/nav-link';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { SCHOOL } from '@/lib/format';

type Props = { children: React.ReactNode; params: Promise<{ locale: string }> };

export default async function DashboardLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  // The middleware already redirects anonymous visitors; this is the backstop
  // for the case where the session dies between the middleware and the render.
  const profile = await getProfile();
  if (!profile) {
    redirect({ href: '/login', locale });
    return null;
  }

  const t = await getTranslations('Nav');

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b bg-card print:hidden">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
          <span className="font-semibold tracking-tight">{SCHOOL.name}</span>

          <nav className="flex items-center gap-1">
            <NavLink href="/sales">{t('sales')}</NavLink>
            <NavLink href="/stock">{t('stock')}</NavLink>
            <NavLink href="/reports">{t('reports')}</NavLink>
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {profile.full_name || profile.email}
            </span>
            <LanguageSwitcher />
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="sm">
                {t('signOut')}
              </Button>
            </form>
          </div>
        </div>
        <Separator className="print:hidden" />
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 print:max-w-none print:p-0">
        {children}
      </main>
    </div>
  );
}
