import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { BrowserContext } from '@playwright/test';

type CookieEntry = { name: string; value: string; options?: CookieOptions };

/** Crea la sessione nel processo test e la serializza con lo stesso formato SSR usato dall’app. */
export async function installSession(
  context: BrowserContext,
  appUrl: string,
  supabaseUrl: string,
  anonKey: string,
  admin: SupabaseClient,
  email: string,
): Promise<void> {
  const { data: generated, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  const tokenHash = generated?.properties?.hashed_token;
  if (linkError || !tokenHash) throw new Error(`Generazione sessione di prova non riuscita per ${email}.`);

  const anonymous = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: verified, error: verifyError } = await anonymous.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'magiclink',
  });
  if (verifyError || !verified.session) throw new Error(`Verifica sessione di prova non riuscita per ${email}.`);

  const cookies: CookieEntry[] = [];
  const serverClient = createServerClient(supabaseUrl, anonKey, {
    auth: { experimental: { appendPkceFlowIdToRedirects: true } },
    cookies: {
      getAll: () => cookies.map(({ name, value }) => ({ name, value })),
      setAll: (items) => {
        for (const item of items) {
          const found = cookies.find((cookie) => cookie.name === item.name);
          if (found) Object.assign(found, item);
          else cookies.push(item);
        }
      },
    },
  });
  const { error: sessionError } = await serverClient.auth.setSession({
    access_token: verified.session.access_token,
    refresh_token: verified.session.refresh_token,
  });
  if (sessionError || cookies.length === 0) throw new Error(`Serializzazione cookie di prova non riuscita per ${email}.`);

  const url = new URL(appUrl);
  await context.addCookies(cookies.map(({ name, value }) => ({
    name,
    value,
    ...cookies.find((cookie) => cookie.name === name)?.options,
    domain: url.hostname,
    path: '/',
    secure: url.protocol === 'https:',
    sameSite: 'Lax',
    expires: cookies.find((cookie) => cookie.name === name)?.options?.expires?.getTime() === undefined
      ? undefined
      : cookies.find((cookie) => cookie.name === name)!.options!.expires!.getTime() / 1000,
  })));
}
