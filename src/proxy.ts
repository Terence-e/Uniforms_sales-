import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from '@/i18n/routing';
import { updateSession } from '@/lib/supabase/middleware';

const handleI18nRouting = createIntlMiddleware(routing);

/** Route segments reachable without a session (locale prefix stripped). */
const PUBLIC_PATHS = ['/login', '/forgot-password'];

function splitLocale(pathname: string) {
  const [, maybeLocale, ...rest] = pathname.split('/');
  const isLocale = (routing.locales as readonly string[]).includes(maybeLocale);
  return {
    locale: isLocale ? maybeLocale : routing.defaultLocale,
    pathname: isLocale ? `/${rest.join('/')}` : pathname
  };
}

// Renamed from `middleware` in Next.js 16 -- the file convention and export are
// now `proxy` (node_modules/next/dist/docs/.../proxy.md). Behaviour is identical.
export async function proxy(request: NextRequest) {
  // 1. Locale negotiation first -- it may rewrite or redirect.
  const response = handleI18nRouting(request);

  // Don't run the auth guard on a redirect the i18n middleware already issued.
  if (response.headers.get('location')) return response;

  // 2. Refresh Supabase cookies onto that same response.
  const user = await updateSession(request, response);

  // 3. Guard the dashboard.
  const { locale, pathname } = splitLocale(request.nextUrl.pathname);
  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  // Per-role session timeout (A-FR-3.4): 12h for the Seller, 2h for everyone
  // else, measured from the `session_started` stamp set at login. Role comes from
  // the JWT (app_metadata) so this needs no DB query. On expiry we clear the
  // auth cookies and bounce to login with an "expired" notice.
  if (user) {
    const role = (user.app_metadata?.role as string | undefined) ?? '';
    const limitMs = role === 'seller' ? 12 * 60 * 60 * 1000 : 2 * 60 * 60 * 1000;
    const startedRaw = request.cookies.get('session_started')?.value;
    const started = startedRaw ? Number(startedRaw) : NaN;

    if (Number.isFinite(started) && Date.now() - started > limitMs) {
      const url = new URL(`/${locale}/login`, request.url);
      url.searchParams.set('expired', '1');
      const expired = NextResponse.redirect(url);
      for (const cookie of request.cookies.getAll()) {
        if (cookie.name.startsWith('sb-')) expired.cookies.delete(cookie.name);
      }
      expired.cookies.delete('session_started');
      return expired;
    }

    if (!Number.isFinite(started)) {
      // Session that predates this feature: start its clock now.
      response.cookies.set('session_started', String(Date.now()), {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production'
      });
    }
  }

  // First-login gate (A-FR-3.2): a signed-in user still carrying the
  // must_change_password flag is forced onto /change-password and can reach
  // nothing else until it is cleared. Server-side, so the UI cannot skip it.
  if (
    user &&
    user.user_metadata?.must_change_password === true &&
    pathname !== '/change-password'
  ) {
    return NextResponse.redirect(new URL(`/${locale}/change-password`, request.url));
  }

  if (!user && !isPublic) {
    const loginUrl = new URL(`/${locale}/login`, request.url);
    if (pathname !== '/') {
      // Store the locale-stripped path. `signIn` feeds this to the locale-aware
      // redirect, which re-adds the prefix -- passing `/en/sales` here would
      // double it into `/en/en/sales`.
      loginUrl.searchParams.set('redirectTo', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // Already signed in and asking for /login: send them to the locale index,
  // which decides by role. The middleware deliberately does not make that
  // choice itself -- it would need the profile row, and the rule already has a
  // home in app/[locale]/page.tsx.
  if (user && isPublic) {
    return NextResponse.redirect(new URL(`/${locale}`, request.url));
  }

  return response;
}

export const config = {
  // Skip API routes, Next internals and anything with a file extension.
  // The `\\.` is a literal dot in the compiled string -- a single backslash
  // collapses to `.` and the lookahead then excludes every path.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
};
