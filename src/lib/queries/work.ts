import 'server-only';

import { databaseErrorMessage, GENERIC_ERROR } from '@/lib/domain/errors';
import type { Topic, TopicMe, TopicPerson } from '@/lib/queries/topic';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export type WorkTopic = Pick<Topic,
  'id' | 'title' | 'body' | 'format' | 'stage' | 'writer_id' | 'reviewer_id' |
  'review_approved_at' | 'link_title' | 'link_site' | 'last_activity_at' | 'created_at'>;

export type WorkGroups = { write: WorkTopic[]; review: WorkTopic[]; others: WorkTopic[]; stale: Set<string> };
export type WorkResult =
  | { ok: true; topics: WorkTopic[]; groups: WorkGroups; me: TopicMe; people: TopicPerson[]; staleDays: number; stale: Set<string> }
  | { ok: false; message: string };

export function groupWork(topics: WorkTopic[], me: string, staleDays: number, now: Date): WorkGroups {
  const groups: WorkGroups = { write: [], review: [], others: [], stale: new Set<string>() };
  const cutoff = now.getTime() - staleDays * 86_400_000;
  for (const topic of topics) {
    if (topic.stage !== 'verifica' && topic.stage !== 'legale') continue;
    if (new Date(topic.last_activity_at).getTime() < cutoff) groups.stale.add(topic.id);
    if (topic.writer_id === me) groups.write.push(topic);
    else if (topic.reviewer_id === me) groups.review.push(topic);
    else groups.others.push(topic);
  }
  return groups;
}

export async function loadWork(): Promise<WorkResult> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return { ok: false, message: GENERIC_ERROR };
    const [profile, topicsResult, peopleResult, settings] = await Promise.all([
      supabase.from('profiles').select('id,role,active').eq('id', auth.user.id).single(),
      supabase.from('topics')
        .select('id,title,body,format,stage,writer_id,reviewer_id,review_approved_at,link_title,link_site,last_activity_at,created_at')
        .in('stage', ['verifica', 'legale']).order('last_activity_at', { ascending: false }),
      supabase.from('people').select('id,display_name,role,active'),
      supabase.from('settings').select('stale_days').eq('id', 1).single(),
    ]);
    const error = profile.error ?? topicsResult.error ?? peopleResult.error ?? settings.error;
    if (error) return { ok: false, message: databaseErrorMessage(error) };
    if (!profile.data?.active || !topicsResult.data || !peopleResult.data || !settings.data) {
      return { ok: false, message: GENERIC_ERROR };
    }
    const topics = topicsResult.data as WorkTopic[];
    const groups = groupWork(topics, profile.data.id, settings.data.stale_days, new Date());
    return {
      ok: true, topics, groups,
      me: { id: profile.data.id, role: profile.data.role as TopicMe['role'] },
      people: peopleResult.data as TopicPerson[],
      staleDays: settings.data.stale_days,
      stale: groups.stale,
    };
  } catch {
    return { ok: false, message: GENERIC_ERROR };
  }
}
