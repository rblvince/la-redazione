import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, test, vi } from 'vitest';
import { bootstrapMaintainer } from '../../supabase/seed/bootstrap';

type AuthUser = { id: string; email: string };
type Profile = { id: string; email: string; role: string; display_name: string };

function fakeAdmin(options: {
  usersByPage?: AuthUser[][];
  profiles?: Profile[];
} = {}) {
  const usersByPage = options.usersByPage ?? [[]];
  const profiles = [...(options.profiles ?? [])];
  const writes: Array<{ table: string; row: Record<string, string> }> = [];
  const listUsers = vi.fn(async ({ page }: { page: number; perPage: number }) => ({
    data: { users: usersByPage[page - 1] ?? [] }, error: null,
  }));
  const createUser = vi.fn(async ({ email }: { email: string; email_confirm: boolean }) => ({
    data: { user: { id: 'created-user', email } }, error: null,
  }));
  const from = vi.fn((table: string) => ({
    select: () => ({
      eq: (column: string, value: string) => ({
        maybeSingle: async () => ({ data: profiles.find((profile) => profile[column as 'id' | 'email'] === value) ?? null, error: null }),
      }),
    }),
    insert: async (row: Record<string, string>) => {
      writes.push({ table, row });
      return { data: null, error: null };
    },
  }));
  const admin = { auth: { admin: { listUsers, createUser } }, from } as unknown as SupabaseClient;
  return { admin, listUsers, createUser, from, writes };
}

describe('bootstrapMaintainer', () => {
  test('crea account Auth senza password e profilo con email normalizzata', async () => {
    const fake = fakeAdmin();
    const result = await bootstrapMaintainer(fake.admin, { email: '  maintainer@Example.test  ', displayName: ' maintainer ' });

    expect(result).toEqual({ status: 'creato', userId: 'created-user' });
    expect(fake.createUser).toHaveBeenCalledWith({ email: 'maintainer@example.test', email_confirm: true });
    expect(fake.writes).toEqual([{ table: 'profiles', row: {
      id: 'created-user', email: 'maintainer@example.test', display_name: 'maintainer', role: 'manutentore',
    } }]);
  });

  test('usa l’utente Auth già esistente se manca il profilo', async () => {
    const fake = fakeAdmin({ usersByPage: [[{ id: 'existing-user', email: 'maintainer@example.test' }]] });
    const result = await bootstrapMaintainer(fake.admin, { email: 'maintainer@example.test', displayName: 'maintainer' });

    expect(result).toEqual({ status: 'creato', userId: 'existing-user' });
    expect(fake.createUser).not.toHaveBeenCalled();
    expect(fake.writes[0]?.row.id).toBe('existing-user');
  });

  test('non scrive se il profilo manutentore è già presente', async () => {
    const fake = fakeAdmin({
      usersByPage: [[{ id: 'existing-user', email: 'maintainer@example.test' }]],
      profiles: [{ id: 'existing-user', email: 'maintainer@example.test', role: 'manutentore', display_name: 'maintainer' }],
    });
    const result = await bootstrapMaintainer(fake.admin, { email: 'maintainer@example.test', displayName: 'Altro nome' });

    expect(result).toEqual({ status: 'già presente', userId: 'existing-user' });
    expect(fake.createUser).not.toHaveBeenCalled();
    expect(fake.writes).toEqual([]);
  });

  test('rifiuta un profilo con altro ruolo senza scrivere', async () => {
    const fake = fakeAdmin({
      usersByPage: [[{ id: 'existing-user', email: 'maintainer@example.test' }]],
      profiles: [{ id: 'existing-user', email: 'maintainer@example.test', role: 'membro', display_name: 'maintainer' }],
    });

    await expect(bootstrapMaintainer(fake.admin, { email: 'maintainer@example.test', displayName: 'maintainer' }))
      .rejects.toThrow('PROFILE_CONFLICT');
    expect(fake.createUser).not.toHaveBeenCalled();
    expect(fake.writes).toEqual([]);
  });

  test('rifiuta un profilo con email diversa senza scrivere', async () => {
    const fake = fakeAdmin({
      usersByPage: [[{ id: 'existing-user', email: 'maintainer@example.test' }]],
      profiles: [{ id: 'existing-user', email: 'altra@example.test', role: 'manutentore', display_name: 'maintainer' }],
    });

    await expect(bootstrapMaintainer(fake.admin, { email: 'maintainer@example.test', displayName: 'maintainer' }))
      .rejects.toThrow('PROFILE_CONFLICT');
    expect(fake.createUser).not.toHaveBeenCalled();
    expect(fake.writes).toEqual([]);
  });

  test('rifiuta email non valida e nome vuoto prima di leggere o scrivere', async () => {
    const fake = fakeAdmin();
    await expect(bootstrapMaintainer(fake.admin, { email: 'non-valida', displayName: 'maintainer' }))
      .rejects.toThrow('INVALID_INPUT');
    await expect(bootstrapMaintainer(fake.admin, { email: 'maintainer@example.test', displayName: ' ' }))
      .rejects.toThrow('INVALID_INPUT');
    expect(fake.from).not.toHaveBeenCalled();
    expect(fake.listUsers).not.toHaveBeenCalled();
    expect(fake.createUser).not.toHaveBeenCalled();
  });

  test('cerca l’utente Auth nelle pagine successive e si ferma quando lo trova', async () => {
    const fake = fakeAdmin({ usersByPage: [
      [{ id: 'other', email: 'other@example.test' }],
      [{ id: 'existing-user', email: 'maintainer@example.test' }],
      [{ id: 'unused', email: 'unused@example.test' }],
    ] });
    const result = await bootstrapMaintainer(fake.admin, { email: 'maintainer@example.test', displayName: 'maintainer' });

    expect(result.userId).toBe('existing-user');
    expect(fake.listUsers.mock.calls.map(([arg]) => arg.page)).toEqual([1, 2]);
    expect(fake.createUser).not.toHaveBeenCalled();
  });

  test('non crea Auth se l’email è già legata a un profilo senza utente trovato', async () => {
    const fake = fakeAdmin({ profiles: [
      { id: 'other-user', email: 'maintainer@example.test', role: 'manutentore', display_name: 'maintainer' },
    ] });

    await expect(bootstrapMaintainer(fake.admin, { email: 'maintainer@example.test', displayName: 'maintainer' }))
      .rejects.toThrow('PROFILE_CONFLICT');
    expect(fake.createUser).not.toHaveBeenCalled();
    expect(fake.writes).toEqual([]);
  });
});
