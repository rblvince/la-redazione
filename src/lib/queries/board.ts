import 'server-only';

import { databaseErrorMessage, GENERIC_ERROR } from '@/lib/domain/errors';
import type { Stage } from '@/lib/domain/stage';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export type BoardTopic = {
  id: string;
  title: string;
  link_title: string | null;
  link_site: string | null;
  comment_count: number;
  format: string | null;
  stage: Stage;
  round: number;
  last_activity_at: string;
  created_at: string;
  proposed_by: string;
  votes: { voterId: string; value: boolean }[];
};

export type BoardPerson = {
  id: string;
  display_name: string;
  role: 'manutentore' | 'decisore' | 'membro';
  active: boolean;
};

export type BoardView = 'da_decidere' | 'decisi' | 'parcheggiati';
export type BoardResult =
  | { ok: true; topics: BoardTopic[]; me: Pick<BoardPerson, 'id' | 'role'>; people: BoardPerson[]; deciders: string[]; staleDays: number }
  | { ok: false; message: string };

export function groupBoard(
  topics: BoardTopic[], me: string, deciders: string[], staleDays: number, now: Date,
): { mine: BoardTopic[]; others: BoardTopic[]; stale: Set<string> } {
  const mine: BoardTopic[] = [];
  const others: BoardTopic[] = [];
  const stale = new Set<string>();
  const isDecider = deciders.includes(me);
  const cutoff = now.getTime() - staleDays * 86_400_000;
  for (const topic of topics) {
    if (new Date(topic.last_activity_at).getTime() < cutoff) stale.add(topic.id);
    if (topic.stage !== 'da_decidere') continue;
    if (isDecider && !topic.votes.some((vote) => vote.voterId === me)) mine.push(topic);
    else others.push(topic);
  }
  return { mine, others, stale };
}

const stagesByView: Record<BoardView, Stage[]> = {
  da_decidere: ['da_decidere'],
  decisi: ['verifica', 'legale', 'pubblicato'],
  parcheggiati: ['parcheggiato'],
};

export async function loadBoard(view: BoardView): Promise<BoardResult> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return { ok: false, message: GENERIC_ERROR };

    const [profile, peopleResult, settings, topicsResult] = await Promise.all([
      supabase.from('profiles').select('id,role,active').eq('id', auth.user.id).single(),
      supabase.from('people').select('id,display_name,role,active'),
      supabase.from('settings').select('stale_days').eq('id', 1).single(),
      supabase.from('topics')
        .select('id,title,link_title,link_site,format,stage,round,last_activity_at,created_at,proposed_by')
        .in('stage', stagesByView[view]).order('last_activity_at', { ascending: false }),
    ]);
    const error = profile.error ?? peopleResult.error ?? settings.error ?? topicsResult.error;
    if (error) return { ok: false, message: databaseErrorMessage(error) };
    if (!profile.data?.active || !settings.data || !peopleResult.data || !topicsResult.data) {
      return { ok: false, message: GENERIC_ERROR };
    }

    const rows = topicsResult.data as Omit<BoardTopic, 'votes' | 'comment_count'>[];
    const ids = rows.map((topic) => topic.id);
    const [votesResult, commentsResult] = await Promise.all([
      ids.length ? supabase.from('votes').select('topic_id,voter_id,round,value').in('topic_id', ids)
        : Promise.resolve({ data: [], error: null }),
      ids.length ? supabase.from('comments').select('topic_id').in('topic_id', ids)
        : Promise.resolve({ data: [], error: null }),
    ]);
    const relatedError = votesResult.error ?? commentsResult.error;
    if (relatedError) return { ok: false, message: databaseErrorMessage(relatedError) };
    const votesByTopic = new Map<string, BoardTopic['votes']>();
    const roundByTopic = new Map(rows.map((topic) => [topic.id, topic.round]));
    for (const vote of votesResult.data ?? []) {
      if (vote.round !== roundByTopic.get(vote.topic_id)) continue;
      const current = votesByTopic.get(vote.topic_id) ?? [];
      current.push({ voterId: vote.voter_id, value: vote.value });
      votesByTopic.set(vote.topic_id, current);
    }
    const commentCounts = new Map<string, number>();
    for (const comment of commentsResult.data ?? []) {
      commentCounts.set(comment.topic_id, (commentCounts.get(comment.topic_id) ?? 0) + 1);
    }
    const people = peopleResult.data as BoardPerson[];
    return {
      ok: true,
      topics: rows.map((topic) => ({ ...topic, comment_count: commentCounts.get(topic.id) ?? 0,
        votes: votesByTopic.get(topic.id) ?? [] })),
      me: { id: profile.data.id, role: profile.data.role as BoardPerson['role'] },
      people,
      deciders: people.filter((person) => person.active && person.role === 'decisore').map((person) => person.id),
      staleDays: settings.data.stale_days,
    };
  } catch {
    return { ok: false, message: GENERIC_ERROR };
  }
}
