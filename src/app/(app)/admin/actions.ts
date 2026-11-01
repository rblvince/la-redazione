'use server';

import { z } from 'zod';
import { databaseErrorMessage, errorMessage, GENERIC_ERROR } from '@/lib/domain/errors';
import { emailSchema, newInviteToken, roleSchema, tokenHash, uuidSchema } from '@/lib/domain/invite';
import { createServerSupabaseClient } from '@/lib/supabase/server';

type ActionResult = { ok: boolean; message: string; link?: string };

async function callAdminRpc(name: string, params: Record<string, unknown>): Promise<ActionResult> {
  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.rpc(name, params);
    return error
      ? { ok: false, message: databaseErrorMessage(error) }
      : { ok: true, message: 'Modifica salvata.' };
  } catch {
    return { ok: false, message: GENERIC_ERROR };
  }
}

export async function inviteAction(form: FormData): Promise<ActionResult> {
  if (!(form instanceof FormData)) return { ok: false, message: errorMessage('dati_non_validi') };
  const email = emailSchema.safeParse(form.get('email'));
  const role = roleSchema.safeParse(form.get('role'));
  if (!email.success || !role.success) return { ok: false, message: errorMessage('dati_non_validi') };
  try {
    const base = process.env.APP_URL;
    if (!base) return { ok: false, message: GENERIC_ERROR };
    const inviteUrl = new URL('/invito/', base);
    const supabase = await createServerSupabaseClient();
    const token = newInviteToken();
    const { error } = await supabase.rpc('create_invite', {
      p_email: email.data, p_role: role.data, p_token_hash: tokenHash(token),
    });
    if (error) return { ok: false, message: databaseErrorMessage(error) };
    return { ok: true, message: 'Invito creato.', link: new URL(token, inviteUrl).toString() };
  } catch {
    return { ok: false, message: GENERIC_ERROR };
  }
}

export async function revokeInviteAction(id: string): Promise<ActionResult> {
  const parsed = uuidSchema.safeParse(id);
  return parsed.success ? callAdminRpc('revoke_invite', { p_id: parsed.data }) : { ok: false, message: errorMessage('dati_non_validi') };
}

export async function setRoleAction(userId: string, role: string): Promise<ActionResult> {
  const user = uuidSchema.safeParse(userId);
  const newRole = roleSchema.safeParse(role);
  return user.success && newRole.success
    ? callAdminRpc('set_role', { p_user: user.data, p_role: newRole.data })
    : { ok: false, message: errorMessage('dati_non_validi') };
}

export async function setActiveAction(userId: string, active: boolean): Promise<ActionResult> {
  const user = uuidSchema.safeParse(userId);
  const state = z.boolean().safeParse(active);
  return user.success && state.success
    ? callAdminRpc('set_active', { p_user: user.data, p_active: state.data })
    : { ok: false, message: errorMessage('dati_non_validi') };
}

export async function setDecisionRuleAction(rule: string): Promise<ActionResult> {
  const parsed = z.enum(['unanimita', 'maggioranza']).safeParse(rule);
  return parsed.success
    ? callAdminRpc('set_decision_rule', { p_rule: parsed.data })
    : { ok: false, message: errorMessage('dati_non_validi') };
}

export async function setStaleDaysAction(days: number): Promise<ActionResult> {
  const parsed = z.number().int().min(1).safeParse(days);
  return parsed.success
    ? callAdminRpc('set_stale_days', { p_days: parsed.data })
    : { ok: false, message: errorMessage('dati_non_validi') };
}
