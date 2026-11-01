import 'server-only';

import { databaseErrorMessage, GENERIC_ERROR } from '@/lib/domain/errors';
import type { TopicMe, TopicPerson } from '@/lib/queries/topic';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export type PeopleResult =
  | { ok: true; people: TopicPerson[]; me: TopicMe; canInvite: boolean }
  | { ok: false; message: string };

export async function loadPeople(): Promise<PeopleResult> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return { ok: false, message: GENERIC_ERROR };
    const [profile, peopleResult] = await Promise.all([
      supabase.from('profiles').select('id,role,active').eq('id', auth.user.id).single(),
      supabase.from('people').select('id,display_name,role,active'),
    ]);
    const error = profile.error ?? peopleResult.error;
    if (error) return { ok: false, message: databaseErrorMessage(error) };
    if (!profile.data?.active || !peopleResult.data) return { ok: false, message: GENERIC_ERROR };
    const role = profile.data.role as TopicMe['role'];
    return {
      ok: true, people: peopleResult.data as TopicPerson[],
      me: { id: profile.data.id, role },
      canInvite: role === 'decisore' || role === 'manutentore',
    };
  } catch {
    return { ok: false, message: GENERIC_ERROR };
  }
}
