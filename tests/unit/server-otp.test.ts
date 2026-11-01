import { afterEach, expect, test, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({
  cookies: async () => ({ getAll: () => [], set: vi.fn() }),
}));

import { createServerSupabaseClient } from '@/lib/supabase/server';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

test('signInWithOtp invia una redirect con sb_flow_id usando il client SSR reale', async () => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://supabase.example.test');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'public-test-key');
  const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
    void _input;
    void _init;
    return new Response('{}', {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetch);
  const client = await createServerSupabaseClient();
  const result = await client.auth.signInWithOtp({
    email: 'test@example.test',
    options: { shouldCreateUser: false, emailRedirectTo: 'https://redazione.example.test/auth/callback' },
  });
  expect(result.error).toBeNull();
  expect(fetch).toHaveBeenCalledOnce();
  const requestUrl = new URL(String(fetch.mock.calls[0][0]));
  const redirect = new URL(requestUrl.searchParams.get('redirect_to') ?? '');
  expect(redirect.origin).toBe('https://redazione.example.test');
  expect(redirect.pathname).toBe('/auth/callback');
  expect(redirect.searchParams.get('sb_flow_id')).toMatch(/^[a-f0-9]{32}$/);
});
