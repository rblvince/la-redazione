import { describe, expect, test } from 'vitest';
import { createDb } from './harness';

describe('database harness', () => {
  test('anon non legge una tabella con RLS', async () => {
    const db = await createDb();
    await db.admin.query(`create table t(x int); alter table t enable row level security; grant select on t to anon; insert into t values (1)`);
    expect(await db.as(null).query('select * from t')).toEqual([]);
  });

  test('auth.uid() restituisce l utente impersonato', async () => {
    const db = await createDb();
    const id = '00000000-0000-0000-0000-000000000001';
    expect((await db.as(id).query<{ u: string }>('select auth.uid() as u'))[0].u).toBe(id);
  });
});
