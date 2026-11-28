import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { cookieOptions } from './lib/supabase';

const PUBLIC = ['/login', '/signup', '/forgot-password', '/auth/callback', '/finance-config.js'];

// Refreshes the Supabase session cookie on every request and sends signed-out users to /login
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookieOptions,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list) {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const path = request.nextUrl.pathname;
  if (!data?.claims && !PUBLIC.some((p) => path.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  // /api is Stock Manager's server (next.config.ts passes it on). It checks its own sign-in.
  // The apps' own script and font files hold nothing private: no sign-in check, so they load sooner and a signed-out
  // browser never keeps a redirect in place of a file.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/|finance/_expo/|finance/assets/|stock-app/static/|.*\\.(?:jpg|jpeg|png|svg|webp|ico)$).*)'],
};
