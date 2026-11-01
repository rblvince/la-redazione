import { afterEach, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { safeNext } from '@/lib/domain/safe-next';

type ExchangeResult = { error: Error | null };
type ExchangeCodeForSession = (code: string, options?: { flowId: string }) => Promise<ExchangeResult>;

const fake = vi.hoisted(() => ({ createServerClient: vi.fn() }));
vi.mock('@supabase/ssr', () => ({ createServerClient: fake.createServerClient }));
vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [], set: vi.fn() }) }));

import { GET } from '@/app/auth/callback/route';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

test('next accetta solo percorsi locali sicuri', () => {
  for (const value of ['https://x', '//x', '/\\x', '/x\\y', 'javascript:', '', '/\nmaligno']) {
    expect(safeNext(value)).toBe('/temi');
  }
  expect(safeNext(null)).toBe('/temi');
  expect(safeNext('/tema/1')).toBe('/tema/1');
});

test('callback riuscito porta cookie e header anti-cache sulla redirect', async () => {
  vi.stubEnv('APP_URL', 'https://redazione.example.test');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://supabase.example.test');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'public-test-key');
  const exchanged = vi.fn<ExchangeCodeForSession>(async () => ({ error: null }));
  fake.createServerClient.mockImplementation((_url, _key, options) => ({
    auth: { exchangeCodeForSession: async (...args: [string, { flowId: string }?]) => {
      exchanged(...args);
      await options.cookies.setAll(
        [{ name: 'sb-session', value: 'session', options: { path: '/', httpOnly: true } }],
        { 'Cache-Control': 'private, no-store', Expires: '0', Pragma: 'no-cache' },
      );
      return { error: null };
    } },
  }));
  const response = await GET(new NextRequest('https://redazione.example.test/auth/callback?code=ok&next=%2Ftemi'));
  expect(response.headers.get('location')).toBe('https://redazione.example.test/temi');
  expect(exchanged).toHaveBeenCalledOnce();
  expect(exchanged).toHaveBeenCalledWith('ok', undefined);
  expect(response.cookies.get('sb-session')?.value).toBe('session');
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  expect(response.headers.get('Expires')).toBe('0');
  expect(response.headers.get('Pragma')).toBe('no-cache');
});

test('con due flussi il primo link seleziona il primo verificatore', async () => {
  vi.stubEnv('APP_URL', 'https://redazione.example.test');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://supabase.example.test');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'public-test-key');
  const first = 'a'.repeat(32);
  const second = 'b'.repeat(32);
  const values = new Map([
    [`test-auth-flow-${first}-code-verifier`, JSON.stringify('first-verifier')],
    [`test-auth-flow-${second}-code-verifier`, JSON.stringify('second-verifier')],
    ['test-auth-code-verifier', JSON.stringify('second-verifier')],
  ]);
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
  const fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    void init;
    return new Response(JSON.stringify({ error: 'invalid_grant' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  });
  const client = createClient('https://supabase.example.test', 'public-test-key', {
    auth: { flowType: 'pkce', storageKey: 'test-auth', storage, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch },
  });
  fake.createServerClient.mockReturnValue(client);
  await GET(new NextRequest(
    `https://redazione.example.test/auth/callback?code=first-code&sb_flow_id=${first}`,
  ));
  expect(fetch).toHaveBeenCalledOnce();
  expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toMatchObject({
    auth_code: 'first-code', code_verifier: 'first-verifier',
  });
});

test('sb_flow_id non valido viene ignorato', async () => {
  vi.stubEnv('APP_URL', 'https://redazione.example.test');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://supabase.example.test');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'public-test-key');
  const exchanged = vi.fn<ExchangeCodeForSession>(async () => ({ error: null }));
  fake.createServerClient.mockReturnValue({ auth: { exchangeCodeForSession: exchanged } });
  await GET(new NextRequest('https://redazione.example.test/auth/callback?code=ok&sb_flow_id=bad%2Fid'));
  expect(exchanged).toHaveBeenCalledWith('ok', undefined);
});

test('callback reindirizza al percorso sicuro esatto usando APP_URL', async () => {
  vi.stubEnv('APP_URL', 'https://example.test');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://supabase.example.test');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'public-test-key');
  const exchanged = vi.fn<ExchangeCodeForSession>(async () => ({ error: null }));
  fake.createServerClient.mockReturnValue({ auth: { exchangeCodeForSession: exchanged } });

  const success = await GET(new NextRequest('http://localhost:3005/auth/callback?code=ok&next=%2Ftemi'));
  expect(success.headers.get('location')).toBe('https://example.test/temi');
  expect(exchanged).toHaveBeenCalledOnce();
  expect(exchanged).toHaveBeenCalledWith('ok', undefined);
  expect(success.status).toBe(307);

  exchanged.mockResolvedValue({ error: new Error('invalid link') });
  const failure = await GET(new NextRequest('http://localhost:3005/auth/callback?code=bad'));
  expect(failure.headers.get('location')).toBe('https://example.test/accedi?errore=link');
});

test('callback registra solo il codice di errore dello scambio fallito', async () => {
  vi.stubEnv('APP_URL', 'https://example.test');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://supabase.example.test');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'public-test-key');
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  fake.createServerClient.mockReturnValue({ auth: { exchangeCodeForSession: async () => ({
    error: { code: 'flow_state_not_found', status: 400, message: 'secret@example.test 123456' },
  }) } });
  await GET(new NextRequest('https://example.test/auth/callback?code=123456'));
  expect(errorSpy).toHaveBeenCalledWith('[auth/callback] scambio fallito: flow_state_not_found');
  expect(errorSpy.mock.calls.flat().join(' ')).not.toContain('123456');
  expect(errorSpy.mock.calls.flat().join(' ')).not.toContain('secret@example.test');
  errorSpy.mockRestore();
});

test.each(['ftp://example.test', 'file:///tmp/base', 'mailto:a@b.test', 'localhost:3005', '']) (
  'APP_URL non valido %s restituisce errore relativo senza scambiare il codice', async (appUrl) => {
    vi.stubEnv('APP_URL', appUrl);
    const exchanged = vi.fn<ExchangeCodeForSession>(async () => ({ error: null }));
    fake.createServerClient.mockReturnValue({ auth: { exchangeCodeForSession: exchanged } });

    const response = await GET(new NextRequest('http://localhost:3005/auth/callback?code=ok'));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('/accedi?errore=link');
    expect(exchanged).not.toHaveBeenCalled();
  },
);

test('APP_URL assente restituisce errore relativo senza scambiare il codice', async () => {
  vi.stubEnv('APP_URL', undefined);
  const exchanged = vi.fn<ExchangeCodeForSession>(async () => ({ error: null }));
  fake.createServerClient.mockReturnValue({ auth: { exchangeCodeForSession: exchanged } });

  const response = await GET(new NextRequest('http://localhost:3005/auth/callback?code=ok'));
  expect(response.status).toBe(307);
  expect(response.headers.get('location')).toBe('/accedi?errore=link');
  expect(exchanged).not.toHaveBeenCalled();
});

test('senza APP_URL restituisce Location relativa senza scambiare il codice', async () => {
  vi.stubEnv('APP_URL', '');
  const exchanged = vi.fn<ExchangeCodeForSession>(async () => ({ error: null }));
  fake.createServerClient.mockReturnValue({ auth: { exchangeCodeForSession: exchanged } });

  const response = await GET(new NextRequest('http://localhost:3005/auth/callback?code=ok'));
  expect(response.status).toBe(307);
  expect(response.headers.get('location')).toBe('/accedi?errore=link');
  expect(exchanged).not.toHaveBeenCalled();
});

test('senza code restituisce l’errore esatto senza scambiare', async () => {
  vi.stubEnv('APP_URL', 'https://example.test');
  const exchanged = vi.fn<ExchangeCodeForSession>(async () => ({ error: null }));
  fake.createServerClient.mockReturnValue({ auth: { exchangeCodeForSession: exchanged } });

  const response = await GET(new NextRequest('http://localhost:3005/auth/callback'));
  expect(response.status).toBe(307);
  expect(response.headers.get('location')).toBe('https://example.test/accedi?errore=link');
  expect(exchanged).not.toHaveBeenCalled();
});
