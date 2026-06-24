import { NextRequest, NextResponse } from 'next/server';
import { verifySession, COOKIE_NAME } from './lib/auth';

const PUBLIC_PREFIXES = ['/login', '/api/auth', '/api/health', '/api/seed', '/api/board', '/board', '/api/portal', '/portal', '/_next', '/favicon'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;

  if (!session) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (pathname.startsWith('/admin') && session.role === 'SELLER') {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  if (pathname === '/') {
    const dest = session.role === 'SELLER' ? '/dashboard' : '/admin';
    return NextResponse.redirect(new URL(dest, req.url));
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-user-id', session.id);
  requestHeaders.set('x-user-role', session.role);
  requestHeaders.set('x-user-name', session.name);
  requestHeaders.set('x-user-email', session.email);

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
