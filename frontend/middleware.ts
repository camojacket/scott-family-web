import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC = ['/login', '/signup', '/donate', '/favicon.ico', '/images', '/_next', '/api/health'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(p));
  if (isPublic) return NextResponse.next();

  // With Front Door routing both frontend and backend under the same domain,
  // the JSESSIONID cookie is visible to the middleware directly.
  const hasSession = req.cookies.has('JSESSIONID');

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
    '/((?!api|_next|images|favicon.ico).*)',
  ],
};
