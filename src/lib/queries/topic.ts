import 'server-only';

import { z } from 'zod';
import { databaseErrorMessage, GENERIC_ERROR } from '@/lib/domain/errors';
import { uuidSchema } from '@/lib/domain/invite';
import type { Stage } from '@/lib/domain/stage';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export type Topic = {
  id: string; title: string; body: string | null; link_url: string | null;
  link_title: string | null; link_site: string | null; format: string | null;
  stage: Stage; round: number; proposed_by: string; writer_id: string | null;
  reviewer_id: string | null; review_approved_by: string | null;
  review_approved_at: string | null; post_url: string | null; decided_at: string | null;
  published_at: string | null; last_activity_at: string; created_at: string;
};
export type TopicVote = { topic_id: string; voter_id: string; round: number; value: boolean; updated_at: string };
export type TopicComment = { id: string; topic_id: string; author_id: string; body: string; created_at: string };
export type TopicEventRow = { id: number; topic_id: string | null; actor_id: string | null; kind: string; data: Record<string, unknown>; created_at: string };
export type TopicCheck = { topic_id: string; kind: 'verifica' | 'legale'; item: string; done_by: string; done_at: string };
export type TopicSource = { id: string; topic_id: string; title: string; url: string; kind: 'primaria' | 'secondaria'; screenshot_path: string | null; added_by: string; created_at: string };
export type TopicCorrection = { id: string; topic_id: string; body: string; reason: string; new_post_url: string | null; author_id: string; created_at: string };
export type TopicPerson = { id: string; display_name: string; role: 'decisore' | 'membro'; active: boolean };
export type TopicMe = { id: string; role: 'manutentore' | 'decisore' | 'membro' };
export type TopicGate = { ok: boolean; missing: string[] };
export type TopicResult =
  | { ok: true; topic: Topic; votes: TopicVote[]; comments: TopicComment[]; events: TopicEventRow[];
      checks: TopicCheck[]; sources: TopicSource[]; corrections: TopicCorrection[];
      people: TopicPerson[]; me: TopicMe; deciders: string[]; gate: TopicGate | null }
  | { ok: false; notFound: true }
  | { ok: false; message: string };

const gateSchema = z.object({ ok: z.boolean(), missing: z.array(z.string()) });

export async function loadTopic(id: string): Promise<TopicResult> {
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) return { ok: false, notFound: true };
  try {
    const supabase = await createServerSupabaseClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return { ok: false, message: GENERIC_ERROR };

    const [profile, topicResult] = await Promise.all([
      supabase.from('profiles').select('id,role,active').eq('id', auth.user.id).single(),
      supabase.from('topics').select(
        'id,title,body,link_url,link_title,link_site,format,stage,round,proposed_by,writer_id,reviewer_id,review_approved_by,review_approved_at,post_url,decided_at,published_at,last_activity_at,created_at',
      ).eq('id', parsed.data).maybeSingle(),
    ]);
    if (profile.error) return { ok: false, message: databaseErrorMessage(profile.error) };
    if (!profile.data?.active) return { ok: false, message: GENERIC_ERROR };
    if (topicResult.error) return { ok: false, message: databaseErrorMessage(topicResult.error) };
    if (!topicResult.data) return { ok: false, notFound: true };
    const topic = topicResult.data as Topic;

    // gate_status è riservata a decisori e membri dalla migrazione 0010.
    const withGate = profile.data.role !== 'manutentore'
      && (topic.stage === 'verifica' || topic.stage === 'legale');
    const [peopleResult, votesResult, commentsResult, eventsResult, checksResult, sourcesResult,
      correctionsResult, gateResult] = await Promise.all([
      supabase.from('people').select('id,display_name,role,active'),
      supabase.from('votes').select('topic_id,voter_id,round,value,updated_at')
        .eq('topic_id', id).eq('round', topic.round),
      supabase.from('comments').select('id,topic_id,author_id,body,created_at')
        .eq('topic_id', id).order('created_at', { ascending: true }),
      supabase.from('events').select('id,topic_id,actor_id,kind,data,created_at')
        .eq('topic_id', id).order('id', { ascending: true }),
      supabase.from('checks').select('topic_id,kind,item,done_by,done_at').eq('topic_id', id),
      supabase.from('sources').select('id,topic_id,title,url,kind,screenshot_path,added_by,created_at')
        .eq('topic_id', id).order('created_at', { ascending: true }),
      supabase.from('corrections').select('id,topic_id,body,reason,new_post_url,author_id,created_at')
        .eq('topic_id', id).order('created_at', { ascending: true }),
      withGate ? supabase.rpc('gate_status', { p_topic: id }) : Promise.resolve({ data: null, error: null }),
    ]);
    const error = peopleResult.error ?? votesResult.error ?? commentsResult.error ?? eventsResult.error
      ?? checksResult.error ?? sourcesResult.error ?? correctionsResult.error ?? gateResult.error;
    if (error) return { ok: false, message: databaseErrorMessage(error) };
    if (!peopleResult.data || !votesResult.data || !commentsResult.data || !eventsResult.data
      || !checksResult.data || !sourcesResult.data || !correctionsResult.data) {
      return { ok: false, message: GENERIC_ERROR };
    }
    const gate = withGate ? gateSchema.safeParse(gateResult.data) : null;
    if (gate && !gate.success) return { ok: false, message: GENERIC_ERROR };
    const people = peopleResult.data as TopicPerson[];
    return {
      ok: true, topic, votes: votesResult.data as TopicVote[],
      comments: commentsResult.data as TopicComment[], events: eventsResult.data as TopicEventRow[],
      checks: checksResult.data as TopicCheck[], sources: sourcesResult.data as TopicSource[],
      corrections: correctionsResult.data as TopicCorrection[], people,
      me: { id: profile.data.id, role: profile.data.role as TopicMe['role'] },
      deciders: people.filter((person) => person.active && person.role === 'decisore').map((person) => person.id),
      gate: gate?.success ? gate.data : null,
    };
  } catch {
    return { ok: false, message: GENERIC_ERROR };
  }
}
