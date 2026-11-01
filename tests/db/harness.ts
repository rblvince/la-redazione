import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

type Queryable = {
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
};

export type TestDb = {
  as(userId: string | null): Queryable;
  admin: Queryable;
};

const migrationsDir = fileURLToPath(new URL('../../supabase/migrations/', import.meta.url));
const authStubPath = fileURLToPath(new URL('./fixtures/auth_stub.sql', import.meta.url));

async function runQuery<T>(
  executor: Pick<PGlite, 'query' | 'exec'>,
  sql: string,
  params?: unknown[],
): Promise<T[]> {
  if (params === undefined && sql.trim().replace(/;\s*$/, '').includes(';')) {
    const results = await executor.exec(sql);
    return (results.at(-1)?.rows ?? []) as T[];
  }
  return (await executor.query<T>(sql, params)).rows;
}

export async function createDb(): Promise<TestDb> {
  const db = new PGlite();
  await db.waitReady;

  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith('.sql') && !file.endsWith('_storage.sql'))
    .sort();
  const authStub = await readFile(authStubPath, 'utf8');
  await db.exec(authStub);
  for (const file of files) {
    await db.exec(await readFile(path.join(migrationsDir, file), 'utf8'));
  }

  const admin: Queryable = {
    async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
      return runQuery<T>(db, sql, params);
    },
  };

  return {
    admin,
    as(userId) {
      return {
        async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
          return db.transaction(async (tx) => {
            await tx.query(`set local role ${userId === null ? 'anon' : 'authenticated'}`);
            await tx.query("set local request.jwt.claim.sub = ''");
            if (userId !== null) {
              await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
            }
            return runQuery<T>(tx, sql, params);
          });
        },
      };
    },
  };
}
