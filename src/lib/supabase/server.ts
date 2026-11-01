import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';
import { supabaseCookieOptions } from './cookie-options';

export async function createServerSupabaseClient(response?: NextResponse) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Configurazione non disponibile');
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookieOptions: supabaseCookieOptions(process.env.APP_URL),
    auth: { experimental: { appendPkceFlowIdToRedirects: true } },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (items, headers) => {
        for (const { name, value, options } of items) {
          cookieStore.set(name, value, options);
          response?.cookies.set(name, value, options);
        }
        if (response) {
          for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
        }
      },
    },
  });
}
