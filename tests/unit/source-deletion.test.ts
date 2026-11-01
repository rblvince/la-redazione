import { beforeEach, expect, test, vi } from 'vitest';

const fakes = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(), single: vi.fn(), storageFrom: vi.fn(), remove: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: async () => ({
  rpc: fakes.rpc,
  from: fakes.from,
  storage: { from: fakes.storageFrom },
}) }));

import { deleteSourceAction } from '@/app/(app)/tema/[id]/actions';

const sourceId = '44444444-4444-4444-8444-444444444444';
const path = '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp';

beforeEach(() => {
  vi.clearAllMocks();
  fakes.from.mockReturnValue({ select: fakes.select });
  fakes.select.mockReturnValue({ eq: fakes.eq });
  fakes.eq.mockReturnValue({ single: fakes.single });
  fakes.single.mockResolvedValue({ data: { screenshot_path: path }, error: null });
  fakes.rpc.mockResolvedValue({ data: null, error: null });
  fakes.storageFrom.mockReturnValue({ remove: fakes.remove });
  fakes.remove.mockResolvedValue({ data: [], error: null });
});

test('elimina lo screenshot dopo la riga, usando la policy del proprietario', async () => {
  const order: string[] = [];
  fakes.rpc.mockImplementation(async () => { order.push('row'); return { data: null, error: null }; });
  fakes.remove.mockImplementation(async () => { order.push('file'); return { data: [], error: null }; });
  expect(await deleteSourceAction(sourceId)).toEqual({ ok: true });
  expect(fakes.from).toHaveBeenCalledWith('sources');
  expect(fakes.eq).toHaveBeenCalledWith('id', sourceId);
  expect(fakes.rpc).toHaveBeenCalledExactlyOnceWith('delete_source', { p_id: sourceId });
  expect(fakes.storageFrom).toHaveBeenCalledWith('fonti');
  expect(fakes.remove).toHaveBeenCalledExactlyOnceWith([path]);
  expect(order).toEqual(['row', 'file']);
});

test('la rimozione non riuscita non annulla la cancellazione della fonte', async () => {
  fakes.remove.mockResolvedValueOnce({ data: null, error: { message: 'policy DELETE' } });
  expect(await deleteSourceAction(sourceId)).toEqual({ ok: true });
  fakes.remove.mockRejectedValue(new Error('storage non disponibile'));
  expect(await deleteSourceAction(sourceId)).toEqual({ ok: true });
});

test('se la RPC fallisce lo screenshot resta associato alla fonte', async () => {
  fakes.rpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'non_autorizzato' } });
  expect((await deleteSourceAction(sourceId)).ok).toBe(false);
  expect(fakes.remove).not.toHaveBeenCalled();
});
