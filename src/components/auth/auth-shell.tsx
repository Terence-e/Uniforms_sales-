import { SchoolLogo } from '@/components/brand/school-logo';
import { SupportButton } from '@/components/auth/support-button';
import { SCHOOL } from '@/lib/format';

/** Shared frame for the login / forgot-password screens: faded grid background,
 * logo top-left, an optional top-right slot, and a footer with copyright + support. */
export function AuthShell({
  children,
  topRight
}: {
  children: React.ReactNode;
  topRight?: React.ReactNode;
}) {
  const year = new Date().getFullYear();
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-70" aria-hidden />

      <header className="relative z-10 flex items-center justify-between gap-4 px-6 py-5 sm:px-10">
        <SchoolLogo size="sm" />
        {topRight}
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-6">
        {children}
      </main>

      <footer className="relative z-10 flex flex-wrap items-center justify-between gap-3 px-6 py-5 text-xs text-muted-foreground sm:px-10">
        <span>
          © {year} {SCHOOL.name}
        </span>
        <SupportButton />
      </footer>
    </div>
  );
}
