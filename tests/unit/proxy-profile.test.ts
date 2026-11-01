import { afterEach, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';

const fake = vi.hoisted(() => ({
  profile: { data: { active: true } as { active: boolean } | null, error: null as Error | null },
  signOut: vi.fn().mockResolvedValue({ error: null }),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }),
      signOut: fake.signOut,
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => fake.profile }) }) }),
  }),
}));

import { proxy } from '@/proxy';

afterEach(() => {
  fake.profile = { data: { active: true }, error: null };
  fake.signOut.mockClear();
  vi.unstubAllEnvs();
});

test('profilo attivo può aprire il Manuale', async () => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://db.example.test');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
  const response = await proxy(new NextRequest('https://redazione.example.test/manuale'));
  expect(response.headers.get('location')).toBeNull();
  expect(fake.signOut).not.toHaveBeenCalled();
});

test.each([null, { active: false }])('profilo assente o disattivato perde accesso al Manuale: %j', async (profile) => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://db.example.test');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
  fake.profile = { data: profile, error: null };
  const response = await proxy(new NextRequest('https://redazione.example.test/manuale'));
  expect(response.headers.get('location')).toBe('https://redazione.example.test/accedi?errore=accesso');
  expect(fake.signOut).toHaveBeenCalledExactlyOnceWith({ scope: 'local' });
});

test('errore nella lettura del profilo conserva la sessione e mostra il messaggio temporaneo', async () => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://db.example.test');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
  fake.profile = { data: null, error: new Error('query failed') };
  const response = await proxy(new NextRequest('https://redazione.example.test/manuale'));
  expect(response.headers.get('location')).toBe('https://redazione.example.test/accedi?errore=temporaneo');
  expect(fake.signOut).not.toHaveBeenCalled();
});
