import { afterEach, expect, test, vi } from 'vitest';

const createBrowserClient = vi.hoisted(() => vi.fn());
vi.mock('@supabase/ssr', () => ({ createBrowserClient }));

import { createBrowserSupabaseClient } from '@/lib/supabase/browser';

afterEach(() => {
  createBrowserClient.mockClear();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

test.each([
  ['https:', { sameSite: 'lax', path: '/', secure: true }],
  ['http:', { sameSite: 'lax', path: '/' }],
] as const)('passa opzioni cookie adatte al protocollo %s', (protocol, cookieOptions) => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://db.example.test');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
  vi.stubGlobal('window', { location: { protocol, href: `${protocol}//redazione.example.test/` } });
  createBrowserSupabaseClient();
  expect(createBrowserClient).toHaveBeenCalledExactlyOnceWith(
    'https://db.example.test',
    'anon-key',
    { cookieOptions },
  );
});
