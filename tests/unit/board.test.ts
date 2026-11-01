import { describe, expect, test, vi } from 'vitest';

const fakes = vi.hoisted(() => ({ client: null as unknown }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: async () => fakes.client }));

import { groupBoard, loadBoard, type BoardTopic } from '@/lib/queries/board';

const now = new Date('2026-10-26T12:00:00.000Z');

function topic(id: string, daysAgo: number, votes: BoardTopic['votes'] = []): BoardTopic {
  return {
    id, title: id, link_title: null, link_site: null, comment_count: 0, format: null, stage: 'da_decidere', round: 1,
    last_activity_at: new Date(now.getTime() - daysAgo * 86_400_000).toISOString(),
    created_at: now.toISOString(), proposed_by: 'membro', votes,
  };
}

describe('groupBoard', () => {
  test('un voto di Giulia lascia il tema a Marco, ma non a Giulia', () => {
    const topics = [topic('t', 0, [{ voterId: 'giulia', value: true }])];
    expect(groupBoard(topics, 'marco', ['marco', 'giulia'], 4, now).mine.map((t) => t.id)).toEqual(['t']);
    expect(groupBoard(topics, 'giulia', ['marco', 'giulia'], 4, now).others.map((t) => t.id)).toEqual(['t']);
  });

  test('cinque giorni senza attività rendono il tema fermo', () => {
    expect(groupBoard([topic('t', 5)], 'marco', ['marco'], 4, now).stale).toEqual(new Set(['t']));
  });

  test('tre giorni senza attività non rendono il tema fermo', () => {
    expect(groupBoard([topic('t', 3)], 'marco', ['marco'], 4, now).stale).toEqual(new Set());
  });

  test('il manutentore vede i temi ma non ne ha in mine', () => {
    const result = groupBoard([topic('t', 0)], 'maintainer', ['marco', 'giulia'], 4, now);
    expect(result.mine).toEqual([]);
    expect(result.others.map((t) => t.id)).toEqual(['t']);
  });

  test('un voto di un round precedente non conta come votato', async () => {
    const data: Record<string, unknown> = {
      profiles: { id: 'marco', role: 'decisore', active: true },
      people: [{ id: 'marco', display_name: 'Marco', role: 'decisore', active: true }],
      settings: { stale_days: 4 },
      topics: [{ ...topic('t', 0), round: 2 }],
      votes: [{ topic_id: 't', voter_id: 'marco', round: 1, value: true }],
      comments: [{ topic_id: 't' }, { topic_id: 't' }],
    };
    fakes.client = {
      auth: { getUser: async () => ({ data: { user: { id: 'marco' } }, error: null }) },
      from: (table: string) => ({
        select: () => {
          const result = { data: data[table], error: null };
          const query = {
            eq: () => query, single: () => query, in: () => query, order: () => query,
            then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
          };
          return query;
        },
      }),
    };
    const board = await loadBoard('da_decidere');
    expect(board.ok).toBe(true);
    if (!board.ok) return;
    expect(board.topics[0].votes).toEqual([]);
    expect(board.topics[0].comment_count).toBe(2);
    expect(board.topics[0].link_title).toBeNull();
    expect(groupBoard(board.topics, board.me.id, board.deciders, board.staleDays, now).mine.map((t) => t.id))
      .toEqual(['t']);
  });

  test('quattro giorni esatti non superano la soglia di quattro giorni', () => {
    expect(groupBoard([topic('t', 4)], 'marco', ['marco'], 4, now).stale).toEqual(new Set());
  });
});
