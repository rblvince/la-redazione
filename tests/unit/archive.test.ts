import { expect, test, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const fake = vi.hoisted(() => ({ client: null as unknown }));
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: async () => fake.client }));
import { archiveFilter, loadArchive } from '@/lib/queries/archive';

test('cerca titolo e corpo con un filtro PostgREST', () => {
  expect(archiveFilter('istat')).toBe('title.ilike.%istat%,body.ilike.%istat%');
});

test('rimuove i caratteri strutturali e non filtra una ricerca vuota', () => {
  expect(archiveFilter('a,b)(%_*\\')).toBe('title.ilike.%ab%,body.ilike.%ab%');
  expect(archiveFilter('  ,)(%_*\\  ')).toBe('');
  expect(archiveFilter('')).toBe('');
});

test('la ricerca vuota non applica or e limita i pubblicati ordinati per data', async () => {
  const query = {
    select: vi.fn(), eq: vi.fn(), or: vi.fn(), order: vi.fn(),
    limit: vi.fn(async () => ({ data: [], error: null })),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.or.mockReturnValue(query);
  query.order.mockReturnValue(query);
  fake.client = { from: vi.fn(() => query) };
  expect(await loadArchive(' ,)(%_ ')).toEqual({ ok: true, topics: [] });
  expect(query.eq).toHaveBeenCalledWith('stage', 'pubblicato');
  expect(query.or).not.toHaveBeenCalled();
  expect(query.order).toHaveBeenCalledWith('published_at', { ascending: false });
  expect(query.limit).toHaveBeenCalledWith(100);
  expect(await loadArchive('istat')).toEqual({ ok: true, topics: [] });
  expect(query.or).toHaveBeenCalledWith('title.ilike.%istat%,body.ilike.%istat%');
});
