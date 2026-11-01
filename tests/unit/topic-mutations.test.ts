import { beforeEach, expect, test, vi } from 'vitest';

const fakes = vi.hoisted(() => ({ rpc: vi.fn(), revalidatePath: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: fakes.revalidatePath }));
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: async () => ({ rpc: fakes.rpc }) }));

import { addSourceAction, assignPeopleAction, castVoteAction, parkTopicAction, reactivateTopicAction } from '@/app/(app)/tema/[id]/actions';

const topic = '11111111-1111-4111-8111-111111111111';
const writer = '22222222-2222-4222-8222-222222222222';
const reviewer = '33333333-3333-4333-8333-333333333333';

beforeEach(() => {
  vi.clearAllMocks();
  fakes.rpc.mockResolvedValue({ data: null, error: null });
});

test.each([
  ['cast_vote', () => castVoteAction(topic, true), { p_topic: topic, p_value: true }],
  ['park_topic', () => parkTopicAction(topic), { p_topic: topic }],
  ['reactivate_topic', () => reactivateTopicAction(topic), { p_topic: topic }],
  ['assign_people', () => assignPeopleAction(topic, writer, reviewer), { p_topic: topic, p_writer: writer, p_reviewer: reviewer }],
] as const)('%s chiama la RPC e aggiorna tema e bacheca', async (name, run, args) => {
  expect(await run()).toEqual({ ok: true });
  expect(fakes.rpc).toHaveBeenCalledExactlyOnceWith(name, args);
  expect(fakes.revalidatePath).toHaveBeenCalledWith(`/tema/${topic}`);
  expect(fakes.revalidatePath).toHaveBeenCalledWith('/temi');
});

test('input invalidi non chiamano il database', async () => {
  expect((await castVoteAction(topic, 'yes' as never)).ok).toBe(false);
  expect((await parkTopicAction('bad')).ok).toBe(false);
  expect((await reactivateTopicAction('bad')).ok).toBe(false);
  expect((await assignPeopleAction(topic, writer, writer)).ok).toBe(false);
  expect(fakes.rpc).not.toHaveBeenCalled();
});

test('gli errori database producono solo messaggi pubblici', async () => {
  fakes.rpc.mockResolvedValue({ data: null, error: { code: 'XX000', message: 'segreto interno' } });
  const result = await parkTopicAction(topic);
  expect(result.ok).toBe(false);
  expect(JSON.stringify(result)).not.toContain('segreto interno');
  expect(fakes.revalidatePath).not.toHaveBeenCalled();
});

test('addSourceAction accetta il percorso generato per lo screenshot', async () => {
  fakes.rpc.mockResolvedValue({ data: '44444444-4444-4444-8444-444444444444', error: null });
  const path = `${topic}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp`;
  expect(await addSourceAction(topic, 'Fonte', 'https://ansa.it/a', 'primaria', path))
    .toEqual({ ok: true, id: '44444444-4444-4444-8444-444444444444' });
  expect(fakes.rpc).toHaveBeenCalledWith('add_source', expect.objectContaining({ p_screenshot_path: path }));
});
