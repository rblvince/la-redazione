import { describe, expect, test } from 'vitest';
import { seedPeople } from './fixtures';
import { createDb } from './harness';

describe('schema e RLS', () => {
  test('nessun privilegio diverso da SELECT per authenticated e nessuno per anon', async () => {
    const db = await createDb();
    const tables = ['profiles', 'settings', 'topics', 'votes', 'comments', 'events', 'checks', 'sources', 'corrections', 'invites', 'people'];
    const privileges = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'];

    for (const table of tables) {
      for (const role of ['anon', 'authenticated']) {
        for (const privilege of privileges) {
          const [{ allowed }] = await db.admin.query<{ allowed: boolean }>(
            'select has_table_privilege($1, $2, $3) as allowed',
            [role, `public.${table}`, privilege],
          );
          expect(allowed, `${role} ${privilege} public.${table}`).toBe(
            role === 'authenticated' && privilege === 'SELECT' && table !== 'invites',
          );
        }
      }
    }

    for (const role of ['anon', 'authenticated']) {
      for (const column of ['id', 'email', 'role', 'token_hash', 'invited_by', 'display_name_hint', 'expires_at', 'used_at', 'revoked_at', 'created_at']) {
        const [{ allowed }] = await db.admin.query<{ allowed: boolean }>(
          'select has_column_privilege($1, $2, $3, $4) as allowed',
          [role, 'public.invites', column, 'SELECT'],
        );
        expect(allowed, `${role} SELECT public.invites.${column}`).toBe(
          role === 'authenticated' && !['token_hash', 'invited_by'].includes(column),
        );
      }
    }

    for (const role of ['anon', 'authenticated']) {
      for (const privilege of ['USAGE', 'SELECT', 'UPDATE']) {
        const [{ allowed }] = await db.admin.query<{ allowed: boolean }>(
          'select has_sequence_privilege($1, $2, $3) as allowed',
          [role, 'public.events_id_seq', privilege],
        );
        expect(allowed, `${role} ${privilege} public.events_id_seq`).toBe(false);
      }
    }
  });

  test('anon non può leggere nessuna tabella pubblica', async () => {
    const db = await createDb();
    const { marco, giulia } = await seedPeople(db);
    const [{ id: topicId }] = await db.admin.query<{ id: string }>(
      'insert into public.topics (title, proposed_by) values ($1, $2) returning id',
      ['Tema di prova', marco],
    );
    await db.admin.query('insert into public.votes (topic_id, voter_id, round, value) values ($1, $2, 1, true)', [topicId, giulia]);
    await db.admin.query('insert into public.comments (topic_id, author_id, body) values ($1, $2, $3)', [topicId, marco, 'Commento']);
    await db.admin.query('insert into public.events (topic_id, actor_id, kind) values ($1, $2, $3)', [topicId, marco, 'proposta']);
    await db.admin.query('insert into public.checks (topic_id, kind, item, done_by) values ($1, $2, $3, $4)', [topicId, 'verifica', 'isolare', marco]);
    await db.admin.query('insert into public.sources (topic_id, title, url, kind, added_by) values ($1, $2, $3, $4, $5)', [topicId, 'Fonte', 'https://example.test/fonte', 'primaria', marco]);
    await db.admin.query('insert into public.corrections (topic_id, body, reason, author_id) values ($1, $2, $3, $4)', [topicId, 'Testo', 'Motivo', marco]);
    await db.admin.query('insert into public.invites (email, role, token_hash, invited_by) values ($1, $2, $3, $4)', ['nuovo@example.test', 'membro', 'hash-test', marco]);

    for (const table of ['profiles', 'settings', 'topics', 'votes', 'comments', 'events', 'checks', 'sources', 'corrections', 'invites']) {
      await expect(db.as(null).query(`select * from public.${table}`), table)
        .rejects.toMatchObject({ code: '42501' });
    }
  });

  test('membro attivo legge i temi', async () => {
    const db = await createDb();
    const { marco } = await seedPeople(db);
    await db.admin.query('insert into public.topics (title, proposed_by) values ($1, $2)', ['Tema di prova', marco]);

    expect(await db.as(marco).query<{ title: string }>('select title from public.topics')).toEqual([{ title: 'Tema di prova' }]);
  });

  test('membro disattivato non legge nulla', async () => {
    const db = await createDb();
    const { marco, membro } = await seedPeople(db);
    await db.admin.query('insert into public.topics (title, proposed_by) values ($1, $2)', ['Tema di prova', marco]);
    await db.admin.query('update public.profiles set active = false where id = $1', [membro]);

    expect(await db.as(membro).query('select * from public.topics')).toEqual([]);
    expect(await db.as(membro).query('select * from public.profiles')).toEqual([]);
    expect(await db.as(membro).query('select * from public.people')).toEqual([]);
  });

  test('nessuno scrive direttamente', async () => {
    const db = await createDb();
    const { marco } = await seedPeople(db);

    await expect(db.as(marco).query("insert into public.topics(title) values ('x')"))
      .rejects.toMatchObject({ code: '42501' });
  });

  test('truncate rifiutato', async () => {
    const db = await createDb();
    const { marco } = await seedPeople(db);

    await expect(db.as(marco).query('truncate public.settings'))
      .rejects.toMatchObject({ code: '42501' });
  });

  test('oggetti futuri nascono chiusi', async () => {
    const db = await createDb();
    await db.admin.query('create table public.rls_future_probe (id bigserial)');
    await db.admin.query('create table app.rls_future_probe (id bigserial)');
    await db.admin.query('create function public.rls_future_probe() returns integer language sql as $$ select 1 $$');
    await db.admin.query('create function app.rls_future_probe() returns integer language sql as $$ select 1 $$');

    try {
      for (const role of ['anon', 'authenticated']) {
        for (const table of ['public.rls_future_probe', 'app.rls_future_probe']) {
          for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) {
            const [{ allowed }] = await db.admin.query<{ allowed: boolean }>(
              'select has_table_privilege($1, $2, $3) as allowed',
              [role, table, privilege],
            );
            expect(allowed, `${role} ${privilege} ${table}`).toBe(false);
          }
        }
        for (const sequence of ['public.rls_future_probe_id_seq', 'app.rls_future_probe_id_seq']) {
          for (const privilege of ['USAGE', 'SELECT', 'UPDATE']) {
            const [{ allowed }] = await db.admin.query<{ allowed: boolean }>(
              'select has_sequence_privilege($1, $2, $3) as allowed',
              [role, sequence, privilege],
            );
            expect(allowed, `${role} ${privilege} ${sequence}`).toBe(false);
          }
        }
        for (const name of ['public.rls_future_probe()', 'app.rls_future_probe()']) {
          const [{ allowed }] = await db.admin.query<{ allowed: boolean }>(
            'select has_function_privilege($1, $2, $3) as allowed',
            [role, name, 'EXECUTE'],
          );
          expect(allowed, `${role} EXECUTE ${name}`).toBe(false);
        }
      }
    } finally {
      await db.admin.query('drop function app.rls_future_probe()');
      await db.admin.query('drop function public.rls_future_probe()');
      await db.admin.query('drop table app.rls_future_probe');
      await db.admin.query('drop table public.rls_future_probe');
    }
  });

  test('profiles: un membro vede solo sé stesso', async () => {
    const db = await createDb();
    const { maintainer, membro } = await seedPeople(db);

    expect(await db.as(membro).query<{ id: string }>('select id from public.profiles')).toEqual([{ id: membro }]);
    expect(await db.as(maintainer).query<{ id: string }>('select id from public.profiles')).toHaveLength(4);
  });

  test('people non mostra il manutentore', async () => {
    const db = await createDb();
    const { marco } = await seedPeople(db);

    const rows = await db.as(marco).query<{ display_name: string }>('select display_name from public.people order by display_name');
    expect(rows.map(({ display_name }) => display_name)).toEqual(['Giulia', 'Marco', 'Membro']);
  });

  test('people ha solo le colonne previste', async () => {
    const db = await createDb();
    const rows = await db.admin.query<{ column_name: string }>(
      `select column_name from information_schema.columns
       where table_schema = 'public' and table_name = 'people'
       order by ordinal_position`,
    );

    expect(rows.map(({ column_name }) => column_name)).toEqual([
      'id', 'display_name', 'role', 'active',
    ]);
  });

  test('people mostra i disattivati con active=false', async () => {
    const db = await createDb();
    const { marco, membro } = await seedPeople(db);
    await db.admin.query('update public.profiles set active = false where id = $1', [membro]);

    const rows = await db.as(marco).query<{ display_name: string; active: boolean }>(
      'select display_name, active from public.people order by display_name',
    );
    expect(rows).toEqual([
      { display_name: 'Giulia', active: true },
      { display_name: 'Marco', active: true },
      { display_name: 'Membro', active: false },
    ]);
  });

  test('token_hash non leggibile', async () => {
    const db = await createDb();
    const { maintainer, marco } = await seedPeople(db);
    const [{ id }] = await db.admin.query<{ id: string }>(
      'insert into public.invites (email, role, token_hash, invited_by) values ($1, $2, $3, $4) returning id',
      ['nuovo@example.test', 'membro', 'hash-test', maintainer],
    );

    await expect(db.as(marco).query('select token_hash from public.invites'))
      .rejects.toMatchObject({ code: '42501' });
    expect(await db.as(marco).query<{ id: string; email: string }>('select id, email from public.invites'))
      .toEqual([{ id, email: 'nuovo@example.test' }]);
  });

  test('membro non vede gli inviti', async () => {
    const db = await createDb();
    const { marco, membro } = await seedPeople(db);
    await db.admin.query('insert into public.invites (email, role, token_hash, invited_by) values ($1, $2, $3, $4)', ['nuovo@example.test', 'membro', 'hash-test', marco]);

    expect(await db.as(membro).query('select id, email from public.invites')).toEqual([]);
    expect(await db.as(marco).query<{ email: string }>('select email from public.invites')).toEqual([{ email: 'nuovo@example.test' }]);
  });
});
