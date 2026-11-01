import 'server-only';

import { databaseErrorMessage, GENERIC_ERROR } from '@/lib/domain/errors';
import type { BoardPerson } from '@/lib/queries/board';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export type AdminPerson = BoardPerson & { email: string | null };
export type AdminInvite = {
  id: string; email: string; role: 'decisore' | 'membro'; display_name_hint: string | null;
  expires_at: string; used_at: string | null; revoked_at: string | null; created_at: string;
};
export type AdminSettings = { decision_rule: 'unanimita' | 'maggioranza'; stale_days: number };
export type AdminResult =
  | { ok: true; people: AdminPerson[]; invites: AdminInvite[]; settings: AdminSettings }
  | { ok: false; forbidden: true }
  | { ok: false; message: string };

export async function loadAdmin(): Promise<AdminResult> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return { ok: false, forbidden: true };
    const profile = await supabase.from('profiles').select('id,role,active').eq('id', auth.user.id).maybeSingle();
    if (profile.error) return { ok: false, message: databaseErrorMessage(profile.error) };
    if (!profile.data?.active || profile.data.role !== 'manutentore') {
      return { ok: false, forbidden: true };
    }

    const [peopleResult, invitesResult, settingsResult] = await Promise.all([
      supabase.from('profiles').select('id,display_name,email,role,active').neq('role', 'manutentore'),
      supabase.from('invites')
        .select('id,email,role,display_name_hint,expires_at,used_at,revoked_at,created_at')
        .order('created_at', { ascending: false }),
      supabase.from('settings').select('decision_rule,stale_days').eq('id', 1).single(),
    ]);
    const error = peopleResult.error ?? invitesResult.error ?? settingsResult.error;
    if (error) return { ok: false, message: databaseErrorMessage(error) };
    if (!peopleResult.data || !invitesResult.data || !settingsResult.data) {
      return { ok: false, message: GENERIC_ERROR };
    }
    return {
      ok: true, people: peopleResult.data as AdminPerson[], invites: invitesResult.data as AdminInvite[],
      settings: settingsResult.data as AdminSettings,
    };
  } catch {
    return { ok: false, message: GENERIC_ERROR };
  }
}
