import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC = ['/login', '/signup', '/favicon.ico', '/images', '/_next', '/api/health'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(p));
  if (isPublic) return NextResponse.next();

  // Read client session from cookie set by backend (e.g., JSESSIONID). If absent, redirect to login.
  const hasSession =
    req.cookies.has('JSESSIONID') ||
    req.cookies.has('SESSION') ||
    req.cookies.has('sf_sess');

  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api (API routes)
     * - .swa (Azure Static Web Apps health check)
     * - _next (Next.js internals)
     * - images, favicon (static assets)
     */
    '/((?!api|.swa|_next|images|favicon.ico).*)',
  ],
};
