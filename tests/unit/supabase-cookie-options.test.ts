import { expect, test } from 'vitest';
import { supabaseCookieOptions } from '@/lib/supabase/cookie-options';

test('i cookie sono Secure solo se APP_URL usa HTTPS', () => {
  expect(supabaseCookieOptions('https://redazione.example.test')).toEqual({ secure: true, sameSite: 'lax', path: '/' });
  expect(supabaseCookieOptions('http://localhost:3000')).toEqual({ sameSite: 'lax', path: '/' });
  expect(supabaseCookieOptions(undefined)).toEqual({ sameSite: 'lax', path: '/' });
});
