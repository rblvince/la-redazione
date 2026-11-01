'use server';

import { emailSchema } from '@/lib/domain/invite';
import { GENERIC_ERROR } from '@/lib/domain/errors';
import { isSendLimit, OTP_REGEX, SEND_LIMIT_MESSAGE } from '@/lib/domain/otp';
import { safeNext } from '@/lib/domain/safe-next';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

const LOGIN_RESPONSE = 'Se l’email è invitata ti è arrivato un codice.';
const INVALID_CODE = 'Codice sbagliato o scaduto. Controlla l’ultima mail o chiedine uno nuovo.';
const VERIFY_LIMIT = 'Troppi tentativi. Aspetta un minuto e riprova.';

function authErrorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    if ('code' in error && typeof error.code === 'string' && /^[a-z0-9_]+$/.test(error.code)) return error.code;
    if ('status' in error && typeof error.status === 'number') return String(error.status);
  }
  return 'eccezione';
}

export async function loginAction(email: string) {
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return { ok: false, message: GENERIC_ERROR };
  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.data,
      options: { shouldCreateUser: false },
    });
    if (error) {
      console.error(`[accedi] invio codice fallito: ${authErrorCode(error)}`);
      if (isSendLimit(error)) {
        return { ok: false, message: SEND_LIMIT_MESSAGE };
      }
    }
  } catch (error) {
    console.error(`[accedi] invio codice fallito: ${authErrorCode(error)}`);
    if (isSendLimit(error)) return { ok: false, message: SEND_LIMIT_MESSAGE };
  }
  return { ok: true, message: LOGIN_RESPONSE };
}

/** Il codice si scambia sul server: il client Supabase scrive i cookie della sessione. */
export async function verifyLoginCodeAction(email: string, code: string): Promise<{ ok: false; message: string } | { ok: true; redirect: string }> {
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success || typeof code !== 'string' || !OTP_REGEX.test(code)) {
    return { ok: false, message: INVALID_CODE };
  }
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.verifyOtp({ email: parsed.data, token: code, type: 'email' });
    if (error?.status === 429) return { ok: false, message: VERIFY_LIMIT };
    if (error || !data.user) return { ok: false, message: INVALID_CODE };
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'status' in error && error.status === 429) {
      return { ok: false, message: VERIFY_LIMIT };
    }
    return { ok: false, message: INVALID_CODE };
  }
  return { ok: true, redirect: '/' };
}

export async function logoutAction(next?: string): Promise<{ ok: false; message: string }> {
  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.signOut();
    if (error) return { ok: false, message: GENERIC_ERROR };
  } catch {
    return { ok: false, message: GENERIC_ERROR };
  }
  redirect(next && safeNext(next) === next ? next : '/accedi');
}
