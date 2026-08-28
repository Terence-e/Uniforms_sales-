import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getProfile, signOut } from '@/actions/auth';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { Button } from '@/components/ui/button';
import type { UserRole } from '@/types/database.types';

type Props = { children: React.ReactNode; params: Promise<{ locale: string }> };

export default async function DashboardLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  // A valid session but no usable profile must NOT redirect to /login: the proxy
  // would send the still-authenticated user straight back here, and the two
  // would ping-pong until the browser throttles navigation. Instead, render a
  // sign-out screen -- signing out clears the session, and /login then loads.
  const profile = await getProfile();
  if (!profile || !profile.is_active) {
    const [t, te] = await Promise.all([
      getTranslations('Nav'),
      getTranslations('Errors')
    ]);
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

  const role = profile.role as UserRole;
  const tDash = await getTranslations('Dashboard');

  return (
    <DashboardShell
      role={role}
      userName={profile.full_name || profile.email}
      roleLabel={tDash(`roles.${role}`)}
      avatarUrl={profile.avatar_url}
    >
      {children}
    </DashboardShell>
  );
}
