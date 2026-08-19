import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, SESSION_DAYS } from '@/lib/auth/constants';

/**
 * First line of defence for the authenticated route group.
 *
 * This only checks for the presence of a session cookie — validating it would
 * require database access, which the edge runtime should not be doing on every
 * navigation. Real authorisation happens in `requireSession()` inside each page and
 * Server Action, which is the check that actually matters (docs/architecture.md §7).
 */
const PROTECTED = [
  '/dashboard',
  '/discover',
  '/life',
  '/goal',
  '/player',
  '/game',
  '/protocol',
  '/reflection',
  '/insight',
  '/council',
  '/settings',
  '/admin',
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const needsAuth = PROTECTED.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
  if (!needsAuth) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    const url = request.nextUrl.clone();
    url.pathname = '/sign-in';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // Re-issue the cookie on every authenticated navigation so an active user's browser
  // cookie never expires ahead of their session row. This lives here rather than in
  // getSessionUser() because a render cannot write cookies — only a response can.
  const response = NextResponse.next();
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  return response;
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/discover/:path*',
    '/life/:path*',
    '/goal/:path*',
    '/player/:path*',
    '/game/:path*',
    '/protocol/:path*',
    '/reflection/:path*',
    '/insight/:path*',
    '/council/:path*',
    '/settings/:path*',
    '/admin/:path*',
  ],
};
