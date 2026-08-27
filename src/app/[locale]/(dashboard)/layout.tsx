import { getTranslations, setRequestLocale } from 'next-intl/server';
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

  const t = await getTranslations('Nav');

  // A valid session but no usable profile must NOT redirect to /login: the proxy
  // would send the still-authenticated user straight back here, and the two
  // would ping-pong until the browser throttles navigation. Instead, render a
  // sign-out screen -- signing out clears the session, and /login then loads.
  const profile = await getProfile();
  if (!profile || !profile.is_active) {
    const te = await getTranslations('Errors');
    return (
      <main className="flex min-h-dvh items-center justify-center bg-muted/40 p-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            {profile ? te('accountDeactivated') : te('noProfile')}
          </p>
          <form action={signOut}>
            <Button type="submit" className="w-full">
              {t('signOut')}
            </Button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b bg-card print:hidden">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
          <span className="font-semibold tracking-tight">{SCHOOL.name}</span>

          <nav className="flex items-center gap-1">
            <NavLink href="/dashboard">{t('dashboard')}</NavLink>
            <NavLink href="/profile">{t('profile')}</NavLink>
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
