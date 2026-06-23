import { NextResponse, type NextRequest } from 'next/server';

// Next.js 16: 'middleware' artık 'proxy'. Auth + rol-bazlı yönlendirme.
// JWT yalnız ROUTING için decode edilir (doğrulama backend'de); güven kaynağı değil.

function decodeRole(token?: string): string | null {
  if (!token) return null;
  try {
    const part = token.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/');
    if (!part) return null;
    const payload = JSON.parse(atob(part)) as { role?: string };
    return payload.role ?? null;
  } catch {
    return null;
  }
}

const STAFF = ['ADMIN', 'PRODUCTION'];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get('od_token')?.value;
  const role = decodeRole(token);

  const isAdminArea = pathname.startsWith('/admin');
  const isDealerArea = pathname.startsWith('/app');

  // Korumalı alanlar: oturum yoksa login'e
  if ((isAdminArea || isDealerArea) && !role) {
    const url = new URL('/login', req.url);
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  // Yanlış role yanlış alan
  if (isAdminArea && !STAFF.includes(role!)) {
    return NextResponse.redirect(new URL('/app', req.url));
  }
  if (isDealerArea && STAFF.includes(role!)) {
    return NextResponse.redirect(new URL('/admin', req.url));
  }
  // Girişliyken login sayfası → uygun panele
  if (pathname === '/login' && role) {
    return NextResponse.redirect(new URL(STAFF.includes(role) ? '/admin' : '/app', req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/|.*\\.).*)'],
};
