import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isPublicPath } from '@/lib/domain/public-path';
import { privateAccess } from '@/lib/domain/private-access';
import { supabaseCookieOptions } from '@/lib/supabase/cookie-options';

export async function proxy(request: NextRequest) {
  if (isPublicPath(request.nextUrl.pathname)) return NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.redirect(new URL('/accedi', request.url));

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookieOptions: supabaseCookieOptions(process.env.APP_URL),
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items, headers) => {
        for (const { name, value } of items) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of items) response.cookies.set(name, value, options);
        for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
      },
    },
  });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    const redirect = NextResponse.redirect(new URL('/accedi', request.url));
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }
  const profile = await supabase.from('profiles').select('active').eq('id', data.user.id).maybeSingle();
  const access = privateAccess(profile.data, profile.error);
  if (access !== 'ok') {
    if (access === 'inattivo') await supabase.auth.signOut({ scope: 'local' });
    const reason = access === 'errore' ? 'temporaneo' : 'accesso';
    const redirect = NextResponse.redirect(new URL(`/accedi?errore=${reason}`, request.url));
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next|favicon.ico).*)'],
};
