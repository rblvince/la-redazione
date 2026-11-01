import { afterEach, expect, test, vi } from 'vitest';
import nextConfig from '../../next.config';

afterEach(() => vi.unstubAllEnvs());

test('header globali, CSP e no-referrer speciale su inviti e callback', async () => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://db.example.test');
  vi.stubEnv('NODE_ENV', 'production');
  const rules = await nextConfig.headers?.();
  expect(rules?.map((rule) => rule.source)).toEqual(['/:path*', '/invito/:path*', '/auth/callback']);
  const global = Object.fromEntries(rules?.[0].headers.map(({ key, value }) => [key, value]) ?? []);
  expect(global).toMatchObject({
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
  });
  expect(global['Content-Security-Policy']).toContain("img-src 'self' data: blob: https://db.example.test");
  expect(global['Content-Security-Policy']).toContain("connect-src 'self' https://db.example.test wss://db.example.test");
  expect(global['Content-Security-Policy']).not.toContain("'unsafe-eval'");
  expect(rules?.slice(1)).toEqual([
    { source: '/invito/:path*', headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }] },
    { source: '/auth/callback', headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }] },
  ]);
});

test('in sviluppo abilita eval per Next e omette HSTS', async () => {
  vi.stubEnv('NODE_ENV', 'development');
  const rules = await nextConfig.headers?.();
  const global = Object.fromEntries(rules?.[0].headers.map(({ key, value }) => [key, value]) ?? []);
  expect(global['Content-Security-Policy']).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
  expect(global).not.toHaveProperty('Strict-Transport-Security');
});
