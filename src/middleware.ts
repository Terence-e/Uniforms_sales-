import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from '@/i18n/routing';
import { updateSession } from '@/lib/supabase/middleware';

const handleI18nRouting = createIntlMiddleware(routing);

/** Route segments reachable without a session (locale prefix stripped). */
const PUBLIC_PATHS = ['/login'];

function splitLocale(pathname: string) {
  const [, maybeLocale, ...rest] = pathname.split('/');
  const isLocale = (routing.locales as readonly string[]).includes(maybeLocale);
  return {
    locale: isLocale ? maybeLocale : routing.defaultLocale,
    pathname: isLocale ? `/${rest.join('/')}` : pathname
  };
}

export async function middleware(request: NextRequest) {
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

  if (!user && !isPublic) {
    const loginUrl = new URL(`/${locale}/login`, request.url);
    if (pathname !== '/') {
      loginUrl.searchParams.set('redirectTo', request.nextUrl.pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (user && isPublic) {
    return NextResponse.redirect(new URL(`/${locale}/sales`, request.url));
  }

  return response;
}

export const config = {
  // Skip API routes, Next internals and anything with a file extension.
  // The `\\.` is a literal dot in the compiled string -- a single backslash
  // collapses to `.` and the lookahead then excludes every path.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
};
