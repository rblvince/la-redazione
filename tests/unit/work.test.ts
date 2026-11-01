import { expect, test, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const fake = vi.hoisted(() => ({ client: null as unknown }));
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: async () => fake.client }));
import { groupWork, loadWork, type WorkTopic } from '@/lib/queries/work';

const now = new Date('2026-10-26T12:00:00Z');

function topic(id: string, stage: WorkTopic['stage'], writer_id: string | null, reviewer_id: string | null): WorkTopic {
  return {
    id, title: id, body: null, format: null, stage, writer_id, reviewer_id,
    review_approved_at: null, link_title: null, link_site: null,
    last_activity_at: now.toISOString(), created_at: now.toISOString(),
  };
}

test('divide solo verifica e legale in scrittura, rilettura e altri', () => {
  const topics = [
    topic('scrivo', 'verifica', 'me', 'other'),
    topic('rileggo', 'legale', 'other', 'me'),
    topic('altro', 'verifica', null, null),
    topic('pubblicato', 'pubblicato', 'me', null),
  ];
  const grouped = groupWork(topics, 'me', 4, now);
  expect(grouped.write.map(({ id }) => id)).toEqual(['scrivo']);
  expect(grouped.review.map(({ id }) => id)).toEqual(['rileggo']);
  expect(grouped.others.map(({ id }) => id)).toEqual(['altro']);
  expect(topics).toHaveLength(4);
});

test('segnala come fermi solo i temi in lavoro oltre la soglia configurata', () => {
  const topics = [
    { ...topic('fermo', 'verifica', 'me', null), last_activity_at: new Date(now.getTime() - 5 * 86_400_000).toISOString() },
    { ...topic('soglia', 'legale', null, 'me'), last_activity_at: new Date(now.getTime() - 4 * 86_400_000).toISOString() },
    { ...topic('pubblicato', 'pubblicato', 'me', null), last_activity_at: new Date(now.getTime() - 5 * 86_400_000).toISOString() },
  ];
  expect(groupWork(topics, 'me', 4, now).stale).toEqual(new Set(['fermo']));
});

test('loadWork legge stale_days dai settings e restituisce i temi fermi', async () => {
  const oldTopic = { ...topic('fermo', 'verifica', 'me', null), last_activity_at: '2020-01-01T00:00:00Z' };
  const data: Record<string, unknown> = {
    profiles: { id: 'me', role: 'membro', active: true },
    topics: [oldTopic],
    people: [],
    settings: { stale_days: 4 },
  };
  const from = vi.fn((table: string) => ({
    select: () => {
      const result = { data: data[table], error: null };
      const query = {
        eq: () => query, single: () => query, in: () => query, order: () => query,
        then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
      };
      return query;
    },
  }));
  fake.client = { auth: { getUser: async () => ({ data: { user: { id: 'me' } }, error: null }) }, from };
  const result = await loadWork();
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(from).toHaveBeenCalledWith('settings');
  expect(result.staleDays).toBe(4);
  expect(result.stale).toEqual(new Set(['fermo']));
});
