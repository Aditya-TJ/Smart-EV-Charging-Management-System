import { NextResponse } from 'next/server';

const SESSION_COOKIE_NAME = 'admin_session_token';

// Routes that do NOT require authentication
const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login',
  '/api/health',
];

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // 1. Allow internal Next.js assets and static files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Forward x-pathname header to server components
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', pathname);

  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  // 2. Handle protected API routes: if token is missing, reject immediately with 401
  if (pathname.startsWith('/api/')) {
    if (isPublicPath) {
      return NextResponse.next({ request: { headers: requestHeaders } });
    }

    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Unauthorized: Administrator authentication required.' },
        { status: 401 }
      );
    }

    // Let the request proceed to the route handler for full database validation
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // 3. Handle /login page: public access allowed
  if (pathname === '/login') {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // 4. Handle protected pages (Dashboard and all 8 modules)
  // Fast rejection if no session cookie exists
  if (!sessionToken) {
    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/') {
      loginUrl.searchParams.set('redirect', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // Proceed with forwarded x-pathname so Server Components can validate the session in MySQL
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
