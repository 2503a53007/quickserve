import { NextResponse, type NextRequest } from 'next/server';
import { isSupabaseConfigured } from '@/lib/env';
import { updateSession } from '@/lib/supabase/middleware';

const PUBLIC_AUTH_PATHS = ['/login', '/signup', '/verify-otp'];

function isPublicPath(pathname: string) {
  return (
    PUBLIC_AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    pathname.startsWith('/api/')
  );
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (isPublicPath(path)) {
    return NextResponse.next();
  }

  // Local dev mode (no Supabase credentials yet): gate the app behind /login using the signed session cookie
  if (!isSupabaseConfigured()) {
    const localSession = request.cookies.get('qs_local_session')?.value;
    if (!localSession) {
      const loginUrl = new URL('/login', request.url);
      if (path !== '/') loginUrl.searchParams.set('next', path);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // Supabase mode: refresh & verify user session; redirect unauthenticated visitors to /login first
  const { response, user } = await updateSession(request);
  if (!user) {
    const loginUrl = new URL('/login', request.url);
    if (path !== '/') loginUrl.searchParams.set('next', path);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons/|images/|firebase-messaging-sw.js).*)',
  ],
};
