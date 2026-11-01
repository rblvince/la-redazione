import { describe, expect, test } from 'vitest';
import { createDb } from './harness';
import { seedPeople } from './fixtures';

async function setup() {
  const db = await createDb();
  const people = await seedPeople(db);
  return { db, ...people };
}

async function propose(db: Awaited<ReturnType<typeof createDb>>, actor: string, overrides: unknown[] = []) {
  const args = ['  Titolo  ', 'Corpo', null, null, 'a_caldo'];
  overrides.forEach((value, index) => { args[index] = value as string; });
  const [row] = await db.as(actor).query<{ id: string }>(
    'select public.propose_topic($1,$2,$3,$4,$5) as id', args,
  );
  return row.id;
}

async function asService(db: Awaited<ReturnType<typeof createDb>>, sql: string, params: unknown[]) {
  await db.admin.query('set role service_role');
  try {
    return await db.admin.query(sql, params);
  } finally {
    await db.admin.query('reset role');
  }
}

describe('temi e commenti', () => {
  test('membro propone, evento non contiene testo libero', async () => {
    const { db, membro } = await setup();
    const id = await propose(db, membro);
    expect(await db.admin.query('select title, stage, proposed_by from public.topics where id = $1', [id]))
      .toEqual([{ title: 'Titolo', stage: 'da_decidere', proposed_by: membro }]);
    expect(await db.admin.query('select kind, topic_id, data from public.events where topic_id = $1', [id]))
      .toEqual([{ kind: 'proposto', topic_id: id, data: { format: 'a_caldo' } }]);
  });

  test('manutentore, disattivato e utente senza profilo non scrivono', async () => {
    const { db, maintainer, marco } = await setup();
    await expect(propose(db, maintainer)).rejects.toMatchObject({ message: 'non_autorizzato' });
    await db.admin.query('update public.profiles set active = false where id = $1', [marco]);
    await expect(propose(db, marco)).rejects.toMatchObject({ message: 'non_autorizzato' });
    await expect(propose(db, '00000000-0000-0000-0000-000000000099'))
      .rejects.toMatchObject({ message: 'non_autorizzato' });
  });

  test('link, titolo, corpo e formato non validi sono rifiutati', async () => {
    const { db, marco } = await setup();
    for (const args of [
      ['   '], ['Titolo', 'x'.repeat(4001)], ['Titolo', null, 'http://x'],
      ['Titolo', null, `https://x.it/${'a'.repeat(2040)}`],
      ['Titolo', null, 'https://utente@x.it'], ['Titolo', null, 'https://x.it/a b'],
      ['Titolo', null, null, null, 'sconosciuto'],
      ['\t\n'], ['\u00a0'], ['\u202f'], ['\u200b'], ['\ufeff'],
      ['Titolo\u202ealterato'], ['Titolo', null, 'https://a.it:8443'],
      ...['https://localhost/x', 'https://printer/x', 'https://host.local/x',
        'https://host.internal/x', 'https://host.localhost/x', 'https://192.0.2.1/x']
        .map((link) => ['Titolo', null, link]),
    ]) {
      await expect(propose(db, marco, args)).rejects.toMatchObject({ message: 'dati_non_validi' });
    }
  });

  test('RPC rifiuta titoli e commenti invisibili, ma accetta lettere accentate, emoji e cifre', async () => {
    const { db, marco } = await setup();
    for (const blank of ['\u00ad\u200e', '\u034f\u115f\uffa0\u{e0020}', '\u0301']) {
      await expect(propose(db, marco, [blank])).rejects.toMatchObject({ message: 'dati_non_validi' });
    }
    const topic = await propose(db, marco);
    for (const blank of ['\u00ad\u200e', '\u034f\u115f\uffa0\u{e0020}', '\u0301']) {
      await expect(db.as(marco).query('select public.add_comment($1,$2)', [topic, blank]))
        .rejects.toMatchObject({ message: 'dati_non_validi' });
    }
    for (const visible of ['è', '🔥', '1']) {
      await expect(propose(db, marco, [visible])).resolves.toBeTruthy();
      await expect(db.as(marco).query('select public.add_comment($1,$2)', [topic, visible]))
        .resolves.toHaveLength(1);
    }
  });

  test('propose_topic ignora sempre il titolo link dichiarato dal chiamante', async () => {
    const { db, marco } = await setup();
    for (const callerTitle of ['Titolo inventato', 'Titolo\u202e falso']) {
      const id = await propose(db, marco, ['Tema', null, 'https://a.it/x', callerTitle]);
      expect(await db.admin.query('select link_title from public.topics where id = $1', [id]))
        .toEqual([{ link_title: null }]);
    }
  });

  test('authenticated non può chiamare set_link_title; service_role richiede il proponente', async () => {
    const { db, marco, membro } = await setup();
    const id = await propose(db, marco, ['Tema', null, 'https://a.it/x']);
    await expect(db.as(marco).query('select public.set_link_title($1,$2,$3)', [id, marco, 'Titolo']))
      .rejects.toMatchObject({ code: '42501' });
    await expect(asService(db, 'select public.set_link_title($1,$2,$3)', [id, membro, 'Altro titolo']))
      .rejects.toMatchObject({ message: 'non_autorizzato' });
    await asService(db, 'select public.set_link_title($1,$2,$3)', [id, marco, '\u200b Titolo \u2060']);
    expect(await db.admin.query('select link_title from public.topics where id = $1', [id]))
      .toEqual([{ link_title: 'Titolo' }]);
  });

  test('set_link_title non sovrascrive un titolo già presente', async () => {
    const { db, marco } = await setup();
    const id = await propose(db, marco, ['Tema', null, 'https://a.it/x']);
    await asService(db, 'select public.set_link_title($1,$2,$3)', [id, marco, 'Primo']);
    await asService(db, 'select public.set_link_title($1,$2,$3)', [id, marco, 'Secondo']);
    expect(await db.admin.query('select link_title from public.topics where id = $1', [id]))
      .toEqual([{ link_title: 'Primo' }]);
  });

  test('set_link_title rifiuta i caratteri bidi', async () => {
    const { db, marco } = await setup();
    const id = await propose(db, marco, ['Tema', null, 'https://a.it/x']);
    await expect(asService(db, 'select public.set_link_title($1,$2,$3)', [id, marco, 'Titolo\u202e falso']))
      .rejects.toMatchObject({ message: 'dati_non_validi' });
    expect(await db.admin.query('select link_title from public.topics where id = $1', [id]))
      .toEqual([{ link_title: null }]);
  });

  test('commento aggiornato nell’attività senza testo nell’evento', async () => {
    const { db, marco, membro } = await setup();
    const id = await propose(db, marco);
    await db.admin.query("update public.topics set last_activity_at = now() - interval '1 day' where id = $1", [id]);
    const [comment] = await db.as(membro).query<{ id: string }>('select public.add_comment($1,$2) as id', [id, '  Idea utile  ']);
    expect(await db.admin.query('select body from public.comments where id = $1', [comment.id]))
      .toEqual([{ body: 'Idea utile' }]);
    expect(await db.admin.query('select last_activity_at > now() - interval \'1 minute\' as recent from public.topics where id = $1', [id]))
      .toEqual([{ recent: true }]);
    expect(await db.admin.query("select data from public.events where topic_id = $1 and kind = 'commento'", [id]))
      .toEqual([{ data: {} }]);
    await expect(db.as(membro).query('select public.add_comment($1,$2)', [id, '   ']))
      .rejects.toMatchObject({ message: 'dati_non_validi' });
    for (const body of ['\t\n', '\u00a0', '\u202f', '\u200b', '\ufeff', 'Testo\u202ealterato']) {
      await expect(db.as(membro).query('select public.add_comment($1,$2)', [id, body]))
        .rejects.toMatchObject({ message: 'dati_non_validi' });
    }
    await expect(db.as(membro).query('select public.add_comment($1,$2)', ['00000000-0000-0000-0000-000000000099', 'Testo']))
      .rejects.toMatchObject({ message: 'dati_non_validi' });
    await db.admin.query('update public.profiles set active = false where id = $1', [membro]);
    await expect(db.as(membro).query('select public.add_comment($1,$2)', [id, 'Testo']))
      .rejects.toMatchObject({ message: 'non_autorizzato' });
  });

  test('il sito del link deriva dall’host anche con titolo link dichiarato dal chiamante', async () => {
    const { db, marco } = await setup();
    const id = await propose(db, marco, ['Tema', null, 'https://truffa.example/x', 'A'.repeat(220), null]);
    expect(await db.admin.query('select link_title, link_site from public.topics where id = $1', [id]))
      .toEqual([{ link_title: null, link_site: 'truffa.example' }]);
    const withWww = await propose(db, marco, ['Altro', null, 'https://www.truffa.example/x', null, null]);
    expect(await db.admin.query('select link_site from public.topics where id = $1', [withWww]))
      .toEqual([{ link_site: 'truffa.example' }]);
    const withTrailingDot = await propose(db, marco, ['Altro', null, 'https://www.example.com./x', null, null]);
    expect(await db.admin.query('select link_site from public.topics where id = $1', [withTrailingDot]))
      .toEqual([{ link_site: 'example.com' }]);
    const numericLabel = await propose(db, marco, ['Altro', null, 'https://2130706433.com/x', null, null]);
    expect(await db.admin.query('select link_site from public.topics where id = $1', [numericLabel]))
      .toEqual([{ link_site: '2130706433.com' }]);
  });

  test('RPC rifiuta gli host IPv4 abbreviati e in esadecimale', async () => {
    const { db, marco } = await setup();
    for (const link of ['https://127.1/x', 'https://10.1/x', 'https://0x7f.1/x', 'https://0x7f.0.0.1/x']) {
      await expect(propose(db, marco, ['Tema', null, link]))
        .rejects.toMatchObject({ message: 'dati_non_validi' });
    }
  });

  test('privilegi RPC e nessuna scrittura diretta per authenticated', async () => {
    const { db, marco } = await setup();
    const signatures = ['public.propose_topic(text,text,text,text,text)', 'public.add_comment(uuid,text)',
      'public.claim_preview()'];
    expect(await db.admin.query("select to_regprocedure('public.propose_topic(text,text,text,text,text,text)') as old"))
      .toEqual([{ old: null }]);
    expect(await db.admin.query("select to_regprocedure('public.set_link_title(uuid,text)') as old"))
      .toEqual([{ old: null }]);
    for (const signature of signatures) {
      for (const role of ['anon', 'authenticated']) {
        const [{ allowed }] = await db.admin.query<{ allowed: boolean }>(
          'select has_function_privilege($1,$2,$3) as allowed', [role, signature, 'EXECUTE'],
        );
        expect(allowed, `${role} ${signature}`).toBe(role === 'authenticated');
      }
    }
    for (const role of ['anon', 'authenticated', 'service_role']) {
      const [{ allowed }] = await db.admin.query<{ allowed: boolean }>(
        'select has_function_privilege($1,$2,$3) as allowed',
        [role, 'public.set_link_title(uuid,uuid,text)', 'EXECUTE'],
      );
      expect(allowed, `${role} set_link_title`).toBe(role === 'service_role');
    }
    for (const role of ['anon', 'authenticated']) {
      const [{ tableAllowed }] = await db.admin.query<{ tableAllowed: boolean }>(
        'select has_table_privilege($1,$2,$3) as "tableAllowed"', [role, 'app.preview_requests', 'SELECT'],
      );
      const [{ cleanAllowed }] = await db.admin.query<{ cleanAllowed: boolean }>(
        'select has_function_privilege($1,$2,$3) as "cleanAllowed"', [role, 'app.clean_text(text)', 'EXECUTE'],
      );
      expect(tableAllowed, `${role} preview_requests`).toBe(false);
      expect(cleanAllowed, `${role} clean_text`).toBe(false);
    }
    await expect(db.as(null).query('select public.propose_topic($1,$2,$3,$4,$5)', ['T', null, null, null, null]))
      .rejects.toMatchObject({ code: '42501' });
    await expect(db.as(null).query('select public.claim_preview()'))
      .rejects.toMatchObject({ code: '42501' });
    await expect(db.as(null).query('select public.add_comment($1,$2)', ['00000000-0000-0000-0000-000000000001', 'T']))
      .rejects.toMatchObject({ code: '42501' });
    const id = await propose(db, marco);
    for (const table of ['topics', 'comments']) {
      for (const privilege of ['INSERT', 'UPDATE']) {
        const [{ allowed }] = await db.admin.query<{ allowed: boolean }>(
          'select has_table_privilege($1,$2,$3) as allowed', ['authenticated', `public.${table}`, privilege],
        );
        expect(allowed, `${table} ${privilege}`).toBe(false);
      }
    }
    await expect(db.as(marco).query('insert into public.topics (title, proposed_by) values ($1,$2)', ['x', marco]))
      .rejects.toMatchObject({ code: '42501' });
    await expect(db.as(marco).query('update public.topics set title = $1 where id = $2', ['x', id]))
      .rejects.toMatchObject({ code: '42501' });
    await expect(db.as(marco).query('insert into public.comments (topic_id,author_id,body) values ($1,$2,$3)', [id, marco, 'x']))
      .rejects.toMatchObject({ code: '42501' });
    await expect(db.as(marco).query('update public.comments set body = $1', ['x']))
      .rejects.toMatchObject({ code: '42501' });
  });

  test('claim_preview autorizza solo membri attivi e limita la ventunesima richiesta', async () => {
    const { db, maintainer, marco, membro } = await setup();
    await expect(db.as(maintainer).query('select public.claim_preview()'))
      .rejects.toMatchObject({ message: 'non_autorizzato' });
    await db.admin.query('update public.profiles set active = false where id = $1', [marco]);
    await expect(db.as(marco).query('select public.claim_preview()'))
      .rejects.toMatchObject({ message: 'non_autorizzato' });
    for (let i = 0; i < 20; i++) await db.as(membro).query('select public.claim_preview()');
    await expect(db.as(membro).query('select public.claim_preview()'))
      .rejects.toMatchObject({ message: 'troppe_richieste' });
    expect(await db.admin.query('select count(*)::int as total from app.preview_requests where user_id = $1', [membro]))
      .toEqual([{ total: 20 }]);
  });
});
