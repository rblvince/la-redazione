import { beforeEach, expect, test, vi } from 'vitest';

const fake = vi.hoisted(() => ({ client: null as unknown, from: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: async () => fake.client }));

import { loadPeople } from '@/lib/queries/people';
import { loadAdmin } from '@/lib/queries/admin';

function table(data: unknown) {
  const result = { data, error: null };
  const query = {
    select: vi.fn(() => query), eq: vi.fn(() => query), neq: vi.fn(() => query), single: vi.fn(() => query),
    maybeSingle: vi.fn(() => query), order: vi.fn(() => query),
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
  };
  return query;
}

beforeEach(() => {
  fake.from.mockReset();
  fake.client = {
    auth: { getUser: async () => ({ data: { user: { id: 'me' } }, error: null }) },
    from: fake.from,
  };
});

test('persone elenca solo la vista people e calcola chi può invitare', async () => {
  const profile = table({ id: 'me', role: 'decisore', active: true });
  const people = table([{ id: 'other', display_name: 'Altra', role: 'membro', active: true }]);
  fake.from.mockImplementation((name: string) => ({ profiles: profile, people }[name]));
  const result = await loadPeople();
  expect(result).toMatchObject({ ok: true, canInvite: true, me: { id: 'me', role: 'decisore' } });
  if (result.ok) expect(result.people.map((person) => person.id)).toEqual(['other']);
  expect(fake.from.mock.calls.map(([name]) => name)).toEqual(['profiles', 'people']);
  expect(people.select).toHaveBeenCalledWith('id,display_name,role,active');
});

test('admin nega al decisore prima di leggere gli elenchi', async () => {
  fake.from.mockImplementation((name: string) => name === 'profiles'
    ? table({ id: 'me', role: 'decisore', active: true }) : undefined);
  expect(await loadAdmin()).toEqual({ ok: false, forbidden: true });
  expect(fake.from).toHaveBeenCalledTimes(1);
});

test('admin tratta un profilo assente come accesso negato', async () => {
  const query = {
    select: () => query,
    eq: () => query,
    single: async () => ({ data: null, error: { code: 'PGRST116' } }),
    maybeSingle: async () => ({ data: null, error: null }),
  };
  fake.from.mockReturnValue(query);
  expect(await loadAdmin()).toEqual({ ok: false, forbidden: true });
  expect(fake.from).toHaveBeenCalledTimes(1);
});

test('admin legge inviti senza token né invited_by e persone senza manutentore', async () => {
  const profile = table({ id: 'me', role: 'manutentore', active: true });
  const people = table([{ id: 'other', display_name: 'Altra', email: 'altra@example.test', role: 'membro', active: true }]);
  const invites = table([{ id: 'invite', email: 'nuova@example.test', role: 'membro', used_at: null, revoked_at: null }]);
  const settings = table({ decision_rule: 'unanimita', stale_days: 4 });
  fake.from.mockImplementation((name: string) => ({
    profiles: fake.from.mock.calls.filter(([tableName]) => tableName === 'profiles').length === 1 ? profile : people,
    invites, settings,
  }[name]));
  const result = await loadAdmin();
  expect(result).toMatchObject({ ok: true, settings: { decision_rule: 'unanimita', stale_days: 4 } });
  expect(people.neq).toHaveBeenCalledWith('role', 'manutentore');
  expect(invites.select).toHaveBeenCalledWith('id,email,role,display_name_hint,expires_at,used_at,revoked_at,created_at');
  expect(people.select).toHaveBeenCalledWith('id,display_name,email,role,active');
});
