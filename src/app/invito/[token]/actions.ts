'use server';

import { databaseErrorMessage, errorMessage, GENERIC_ERROR } from '@/lib/domain/errors';
import { nameSchema, tokenHash, tokenSchema } from '@/lib/domain/invite';
import { isSendLimit, OTP_LENGTH, OTP_REGEX, SEND_LIMIT_MESSAGE } from '@/lib/domain/otp';
import { createAdminClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export type PeekInviteResult =
  | { ok: true; status: 'valido'; email: string }
  | { ok: false; status: 'scaduto' | 'usato' | 'revocato' | 'inesistente'; message: string }
  | { ok: false; status: 'errore'; message: string };
export type InviteLoginResult = { ok: true; message: string } | { ok: false; message: string };
export type AcceptInviteResult = InviteLoginResult | { ok: true; redirect: string };
const INVALID_CODE = 'Codice sbagliato o scaduto. Controlla l’ultima mail o chiedine uno nuovo.';
const VERIFY_LIMIT = 'Troppi tentativi. Aspetta un minuto e riprova.';

export async function peekInviteAction(token: string): Promise<PeekInviteResult> {
  const parsed = tokenSchema.safeParse(token);
  if (!parsed.success) return { ok: false, status: 'inesistente', message: errorMessage('invito_non_valido') };
  try {
    const { data, error } = await createAdminClient().from('invites')
      .select('email,expires_at,used_at,revoked_at')
      .eq('token_hash', tokenHash(parsed.data)).maybeSingle();
    if (error) return { ok: false, status: 'errore', message: GENERIC_ERROR };
    if (!data) return { ok: false, status: 'inesistente', message: errorMessage('invito_non_valido') };
    if (data.revoked_at) return { ok: false, status: 'revocato', message: errorMessage('invito_non_valido') };
    if (data.used_at) return { ok: false, status: 'usato', message: errorMessage('invito_usato') };
    if (new Date(data.expires_at).getTime() <= Date.now()) {
      return { ok: false, status: 'scaduto', message: errorMessage('invito_scaduto') };
    }
    return { ok: true, status: 'valido', email: data.email };
  } catch {
    return { ok: false, status: 'errore', message: GENERIC_ERROR };
  }
}

export async function startInviteLoginAction(token: string, displayName: string): Promise<InviteLoginResult> {
  const parsedToken = tokenSchema.safeParse(token);
  const parsedName = nameSchema.safeParse(displayName);
  if (!parsedToken.success || !parsedName.success) return { ok: false, message: errorMessage('dati_non_validi') };
  try {
    const admin = createAdminClient();
    const { data: email, error: peekError } = await admin.rpc('peek_invite', {
      p_token_hash: tokenHash(parsedToken.data), p_email: null,
    });
    if (peekError) return { ok: false, message: databaseErrorMessage(peekError) };
    if (typeof email !== 'string') return { ok: false, message: GENERIC_ERROR };

    const supabase = await createServerSupabaseClient();
    const { data: session, error: sessionError } = await supabase.auth.getUser();
    if (sessionError && sessionError.name !== 'AuthSessionMissingError') {
      return { ok: false, message: GENERIC_ERROR };
    }
    if (session.user && session.user.email?.trim().toLowerCase() !== email) {
      return { ok: false, message: errorMessage('email_diversa') };
    }

    let userId: string | undefined;
    for (let page = 1; !userId; page += 1) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) return { ok: false, message: errorMessage('invio_fallito') };
      userId = data.users.find((user) => user.email?.trim().toLowerCase() === email)?.id;
      if (data.users.length < 1000) break;
    }
    if (!userId) {
      const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
      if (error || !data.user) return { ok: false, message: errorMessage('invio_fallito') };
    }
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    if (otpError) return { ok: false, message: isSendLimit(otpError) ? SEND_LIMIT_MESSAGE : errorMessage('invio_fallito') };
    return { ok: true, message: `Ti abbiamo mandato un codice di ${OTP_LENGTH} cifre.` };
  } catch (error) {
    if (isSendLimit(error)) return { ok: false, message: SEND_LIMIT_MESSAGE };
    return { ok: false, message: errorMessage('invio_fallito') };
  }
}

/** Verifica il codice e usa l'identità appena autenticata per riscattare l'invito. */
export async function verifyInviteCodeAction(token: string, displayName: string, code: string): Promise<AcceptInviteResult> {
  const parsedToken = tokenSchema.safeParse(token);
  const parsedName = nameSchema.safeParse(displayName);
  if (!parsedToken.success || !parsedName.success) return { ok: false, message: errorMessage('dati_non_validi') };
  if (typeof code !== 'string' || !OTP_REGEX.test(code)) return { ok: false, message: INVALID_CODE };
  try {
    const admin = createAdminClient();
    const hash = tokenHash(parsedToken.data);
    const { data: email, error: peekError } = await admin.rpc('peek_invite', {
      p_token_hash: hash, p_email: null,
    });
    if (peekError) return { ok: false, message: databaseErrorMessage(peekError) };
    if (typeof email !== 'string') return { ok: false, message: GENERIC_ERROR };

    const supabase = await createServerSupabaseClient();
    const { data, error: otpError } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
    if (otpError?.status === 429) return { ok: false, message: VERIFY_LIMIT };
    if (otpError || !data.user) return { ok: false, message: INVALID_CODE };
    if (data.user.email?.trim().toLowerCase() !== email) {
      return { ok: false, message: errorMessage('email_diversa') };
    }
    const { error } = await admin.rpc('redeem_invite', {
      p_token_hash: hash,
      p_user: data.user.id,
      p_email: email,
      p_display_name: parsedName.data,
    });
    if (error) return { ok: false, message: databaseErrorMessage(error) };
    return { ok: true, redirect: '/' };
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'status' in error && error.status === 429) {
      return { ok: false, message: VERIFY_LIMIT };
    }
    return { ok: false, message: GENERIC_ERROR };
  }
}

export async function acceptInviteAction(token: string, displayName: string): Promise<AcceptInviteResult> {
  const parsedToken = tokenSchema.safeParse(token);
  const parsedName = nameSchema.safeParse(displayName);
  if (!parsedToken.success || !parsedName.success) return { ok: false, message: errorMessage('dati_non_validi') };
  try {
    const supabase = await createServerSupabaseClient();
    const { data: session, error: sessionError } = await supabase.auth.getUser();
    if (sessionError && sessionError.name !== 'AuthSessionMissingError') return { ok: false, message: GENERIC_ERROR };
    if (!session.user) return startInviteLoginAction(parsedToken.data, parsedName.data);

    const admin = createAdminClient();
    const hash = tokenHash(parsedToken.data);
    const { data: email, error: peekError } = await admin.rpc('peek_invite', {
      p_token_hash: hash, p_email: null,
    });
    if (peekError) return { ok: false, message: databaseErrorMessage(peekError) };
    if (typeof email !== 'string') return { ok: false, message: GENERIC_ERROR };
    if (session.user.email?.trim().toLowerCase() !== email) {
      return { ok: false, message: errorMessage('email_diversa') };
    }
    const { error } = await admin.rpc('redeem_invite', {
      p_token_hash: hash,
      p_user: session.user.id,
      p_email: email,
      p_display_name: parsedName.data,
    });
    if (error) return { ok: false, message: databaseErrorMessage(error) };
    return { ok: true, redirect: '/' };
  } catch {
    return { ok: false, message: GENERIC_ERROR };
  }
}
