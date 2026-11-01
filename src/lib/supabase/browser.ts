import { createBrowserClient } from '@supabase/ssr';
import { supabaseCookieOptions } from './cookie-options';

export function createBrowserSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Configurazione non disponibile');
  return createBrowserClient(url, key, { cookieOptions: supabaseCookieOptions(window.location.href) });
}
