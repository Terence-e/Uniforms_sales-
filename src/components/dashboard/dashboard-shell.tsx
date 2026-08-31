'use client';

import { useState } from 'react';
import { MenuIcon, XIcon, LogOutIcon, SearchIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { signOut } from '@/actions/auth';
import { SchoolLogo } from '@/components/brand/school-logo';
import { LanguageSwitcher } from '@/components/language-switcher';
import { NotificationBell } from '@/components/dashboard/notification-bell';
import { ReportProblemDialog } from '@/components/bug-report/report-problem-dialog';
import { ThemeToggle } from '@/components/theme-toggle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  NAV_SECTION_ORDER,
  navItemsFor,
  type NavItem,
  type NavSection
} from '@/lib/dashboard-nav';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/types/database.types';

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.map((p) => p[0]).slice(0, 2).join('') || 'U').toUpperCase();
}

export function DashboardShell({
  role,
  userName,
  roleLabel,
  avatarUrl,
  openJobCount,
  children
}: {
  role: UserRole;
  userName: string;
  roleLabel: string;
  avatarUrl?: string | null;
  /** Open orders and alterations, badged on the nav from every screen
   *  (A-FR-9.21). Undefined when it could not be read -- the badge is then
   *  omitted rather than showing a wrong or zero count. */
  openJobCount?: number;
  children: React.ReactNode;
}) {
  const t = useTranslations('Nav');
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();
  const items = navItemsFor(role);

  return (
    <div className="flex min-h-dvh bg-background">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r bg-sidebar lg:flex">
        <SidebarContent items={items} openJobCount={openJobCount} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 flex h-full w-72 flex-col border-r bg-sidebar shadow-xl">
            <div className="flex items-center justify-between px-4 pt-4">
              <SchoolLogo size="sm" />
              <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}>
                <XIcon className="size-5" />
              </Button>
            </div>
            <SidebarContent
              items={items}
              openJobCount={openJobCount}
              onNavigate={() => setMobileOpen(false)}
              hideHeader
            />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-card/80 px-4 backdrop-blur print:hidden">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label={t('menu')}
            onClick={() => setMobileOpen(true)}
          >
            <MenuIcon className="size-5" />
          </Button>

          <div className="lg:hidden">
            <SchoolLogo size="sm" />
          </div>

          {/* The box was a placeholder that only raised a toast; it now goes
              to the real search (A-FR-7.6). Present on every screen, because a
              parent can turn up at the counter mid-anything. */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const q = new FormData(e.currentTarget).get('q');
              const term = typeof q === 'string' ? q.trim() : '';
              router.push(term ? `/search?q=${encodeURIComponent(term)}` : '/search');
            }}
            className="relative hidden max-w-xl flex-1 md:block"
          >
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input name="q" placeholder={t('searchPlaceholder')} className="pl-9" />
          </form>

          <div className="ml-auto flex items-center gap-1.5">
            <LanguageSwitcher />
            <ThemeToggle />
            <NotificationBell />
            <Link
              href="/profile"
              prefetch={false}
              title={`${userName} · ${roleLabel}`}
              className="flex size-9 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-sm font-semibold text-primary ring-1 ring-border transition hover:ring-primary/50"
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- data URL avatar
                <img src={avatarUrl} alt="" className="size-full object-cover" />
              ) : (
                initialsOf(userName)
              )}
            </Link>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 print:max-w-none print:p-0">
          {children}
        </main>

        {/* Every authenticated screen, discreetly (A-13). Sentry catches
            crashes; the failures that matter most here -- a wrong total, a
            receipt naming the wrong parent -- never throw, so the only way to
            hear about them is to make telling someone take ten seconds.
            print:hidden because it has no business on a receipt. */}
        <footer className="mx-auto w-full max-w-7xl px-4 pb-6 sm:px-6 print:hidden">
          <div className="flex justify-center border-t pt-4">
            <ReportProblemDialog />
          </div>
        </footer>
      </div>
    </div>
  );
}

function SidebarContent({
  items,
  openJobCount,
  onNavigate,
  hideHeader
}: {
  items: NavItem[];
  openJobCount?: number;
  onNavigate?: () => void;
  hideHeader?: boolean;
}) {
  const tNav = useTranslations('Nav');
  const tDash = useTranslations('Dashboard');
  const pathname = usePathname();

  const label = (item: NavItem) => {
    if (item.key === 'dashboard') return tNav('dashboard');
    if (item.key === 'profile') return tNav('profile');
    return tDash(`modules.${item.key}.title`);
  };

  const sections = NAV_SECTION_ORDER.map((section) => ({
    section,
    items: items.filter((i) => i.section === section)
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      {!hideHeader && (
        <div className="px-5 pb-2 pt-5">
          <SchoolLogo size="md" />
        </div>
      )}
      <nav className="flex-1 space-y-5 px-3 py-3">
        {sections.map(({ section, items: group }) => (
          <div key={section} className="space-y-1">
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {tNav(`sections.${section as NavSection}`)}
            </p>
            {group.map((item) => {
              const active =
                item.href &&
                (pathname === item.href || pathname.startsWith(`${item.href}/`));
              const Icon = item.icon;
              const content = (
                <>
                  <Icon className="size-[18px] shrink-0" />
                  <span className="truncate">{label(item)}</span>
                  {/* Only when there is something to answer for: a "0" badge is
                      furniture, and the seller stops seeing it. */}
                  {item.key === 'openJobs' && openJobCount ? (
                    <Badge
                      variant={active ? 'secondary' : 'default'}
                      className="ml-auto tabular-nums text-[10px]"
                    >
                      {openJobCount}
                    </Badge>
                  ) : null}
                  {!item.href && (
                    <Badge variant="ghost" className="ml-auto text-[10px]">
                      {tDash('planned')}
                    </Badge>
                  )}
                </>
              );
              const cls = cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : item.href
                    ? 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                    : 'cursor-default text-muted-foreground/60'
              );
              return item.href ? (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={cls}
                >
                  {content}
                </Link>
              ) : (
                <div key={item.key} className={cls} aria-disabled="true">
                  {content}
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t p-3">
        <form action={signOut}>
          <Button
            type="submit"
            variant="ghost"
            className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
          >
            <LogOutIcon className="size-[18px]" />
            {tNav('signOut')}
          </Button>
        </form>
      </div>
    </div>
  );
}
