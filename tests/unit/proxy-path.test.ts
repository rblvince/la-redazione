import { afterEach, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { isPublicPath } from '@/lib/domain/public-path';
import { proxy } from '@/proxy';

afterEach(() => vi.unstubAllEnvs());

test('solo le rotte di accesso dichiarate restano pubbliche', () => {
  for (const path of [
    '/accedi', '/invito', '/invito/abc', '/auth/callback',
    '/manifest.webmanifest', '/icon.svg', '/apple-icon.png', '/robots.txt',
    '/icons/icon-192.png', '/icons/nested/icon.png',
  ]) expect(isPublicPath(path)).toBe(true);
  for (const path of [
    '/', '/admin', '/temi', '/in-lavoro', '/accedi-altro', '/invito-altro', '/auth/callback-altro',
    '/manifest.webmanifest-altro', '/icon.svg-altro', '/apple-icon.png-altro', '/robots.txt-altro', '/icons-altro',
  ]) {
    expect(isPublicPath(path)).toBe(false);
  }
});

test('da sloggati le risorse pubbliche passano e le pagine restano protette', async () => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
  for (const path of [
    '/manifest.webmanifest', '/icon.svg', '/apple-icon.png', '/robots.txt', '/icons/icon-192.png',
  ]) {
    const response = await proxy(new NextRequest(`https://redazione.example.test${path}`));
    expect(response.headers.get('location')).toBeNull();
  }
  for (const path of ['/', '/temi', '/in-lavoro', '/admin']) {
    const response = await proxy(new NextRequest(`https://redazione.example.test${path}`));
    expect(response.headers.get('location')).toBe('https://redazione.example.test/accedi');
  }
});
