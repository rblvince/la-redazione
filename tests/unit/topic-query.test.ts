import { beforeEach, expect, test, vi } from 'vitest';

const fakes = vi.hoisted(() => ({ client: null as unknown, selects: [] as string[], rpc: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: async () => fakes.client }));

import { loadTopic } from '@/lib/queries/topic';

const id = '11111111-1111-4111-8111-111111111111';

function setup(stage: string, topicExists = true, role = 'decisore') {
  const rows: Record<string, unknown> = {
    topics: topicExists ? { id, title: 'Tema', stage, round: 2 } : null,
    profiles: { id: 'marco', role, active: true },
    people: [{ id: 'marco', display_name: 'Marco', role: 'decisore', active: true }],
    votes: [{ topic_id: id, voter_id: 'marco', round: 2, value: true }],
    comments: [], events: [], checks: [], sources: [], corrections: [],
  };
  fakes.client = {
    auth: { getUser: async () => ({ data: { user: { id: 'marco' } }, error: null }) },
    from: (table: string) => ({
      select: (columns: string) => {
        fakes.selects.push(`${table}:${columns}`);
        const result = { data: rows[table], error: null };
        const query = {
          eq: () => query, order: () => query, single: () => query, maybeSingle: () => query,
          then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
        };
        return query;
      },
    }),
    rpc: fakes.rpc,
  };
}

beforeEach(() => {
  fakes.selects = [];
  fakes.rpc.mockReset();
  fakes.rpc.mockResolvedValue({ data: { ok: false, missing: ['copyright'] }, error: null });
});

test('carica dati del tema e cancello in verifica, senza leggere email o invited_by', async () => {
  setup('verifica');
  const result = await loadTopic(id);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.votes).toHaveLength(1);
  expect(result.gate).toEqual({ ok: false, missing: ['copyright'] });
  expect(result.deciders).toEqual(['marco']);
  expect(fakes.rpc).toHaveBeenCalledExactlyOnceWith('gate_status', { p_topic: id });
  expect(fakes.selects.join(' ')).not.toMatch(/email|invited_by/);
  expect(fakes.selects).toContain('people:id,display_name,role,active');
});

test('non chiama gate_status fuori da verifica e legale', async () => {
  setup('pubblicato');
  const result = await loadTopic(id);
  expect(result.ok).toBe(true);
  if (result.ok) expect(result.gate).toBeNull();
  expect(fakes.rpc).not.toHaveBeenCalled();
});

test('il manutentore può leggere il tema senza chiamare una RPC a lui vietata', async () => {
  setup('legale', true, 'manutentore');
  const result = await loadTopic(id);
  expect(result.ok).toBe(true);
  if (result.ok) expect(result.gate).toBeNull();
  expect(fakes.rpc).not.toHaveBeenCalled();
});

test('rifiuta id non validi e distingue temi assenti', async () => {
  expect(await loadTopic('bad')).toEqual({ ok: false, notFound: true });
  setup('verifica', false);
  expect(await loadTopic(id)).toEqual({ ok: false, notFound: true });
});
