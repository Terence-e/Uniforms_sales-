'use client';

import { useState } from 'react';
import { MenuIcon, XIcon, LogOutIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { signOut } from '@/actions/auth';
import { SchoolLogo } from '@/components/brand/school-logo';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  NAV_SECTION_ORDER,
  navItemsFor,
  type NavItem,
  type NavSection
} from '@/lib/dashboard-nav';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/types/database.types';

export function DashboardShell({
  role,
  userName,
  roleLabel,
  children
}: {
  role: UserRole;
  userName: string;
  roleLabel: string;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const items = navItemsFor(role);

  return (
    <div className="flex min-h-dvh bg-background">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r bg-sidebar lg:flex">
        <SidebarContent items={items} />
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
            <SidebarContent items={items} onNavigate={() => setMobileOpen(false)} hideHeader />
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
            aria-label="Menu"
            onClick={() => setMobileOpen(true)}
          >
            <MenuIcon className="size-5" />
          </Button>

          <div className="lg:hidden">
            <SchoolLogo size="sm" showText={false} />
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <LanguageSwitcher />
            <ThemeToggle />
            <div className="mx-1 hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight">{userName}</p>
              <p className="text-xs leading-tight text-muted-foreground">{roleLabel}</p>
            </div>
            <form action={signOut}>
              <Button type="submit" variant="outline" size="sm" className="gap-1.5">
                <LogOutIcon className="size-4" />
                <span className="hidden sm:inline">
                  <SignOutLabel />
                </span>
              </Button>
            </form>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 print:max-w-none print:p-0">
          {children}
        </main>
      </div>
    </div>
  );
}

function SignOutLabel() {
  const t = useTranslations('Nav');
  return <>{t('signOut')}</>;
}

function SidebarContent({
  items,
  onNavigate,
  hideHeader
}: {
  items: NavItem[];
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
    </div>
  );
}
