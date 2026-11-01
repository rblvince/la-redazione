import { describe, expect, test } from 'vitest';
import { createDb, type TestDb } from './harness';
import { seedPeople } from './fixtures';

const verification = ['isolare', 'fonte_primaria', 'lettura_intera', 'secondo_riscontro', 'controllo_legale'];
const legal = ['diffamazione', 'continenza', 'gdpr_minori', 'copyright', 'rettifica'];

async function setup(decided = true) {
  const db = await createDb();
  const people = await seedPeople(db);
  const [{ id: topic }] = await db.as(people.giulia).query<{ id: string }>(
    'select public.propose_topic($1,$2,$3,$4,$5) as id', ['Tema', null, null, null, null],
  );
  if (decided) {
    await db.as(people.marco).query('select public.cast_vote($1,true)', [topic]);
    await db.as(people.giulia).query('select public.cast_vote($1,true)', [topic]);
    await db.as(people.marco).query('select public.assign_people($1,$2,$3)', [topic, people.giulia, people.marco]);
  }
  return { db, topic, ...people };
}

async function check(db: TestDb, user: string, topic: string, kind: string, item: string, done = true) {
  return db.as(user).query('select public.toggle_check($1,$2,$3,$4)', [topic, kind, item, done]);
}

async function status(db: TestDb, user: string, topic: string) {
  const [{ value }] = await db.as(user).query<{ value: { ok: boolean; missing: string[] } }>(
    'select public.gate_status($1) as value', [topic],
  );
  return value;
}

async function fill(db: TestDb, user: string, topic: string) {
  for (const item of verification) await check(db, user, topic, 'verifica', item);
  for (const item of legal) await check(db, user, topic, 'legale', item);
  await addSource(db, user, topic);
}

async function addSource(db: TestDb, user: string, topic: string) {
  const [{ id }] = await db.as(user).query<{ id: string }>(
    'select public.add_source($1,$2,$3,$4,$5) as id',
    [topic, 'Fonte', 'https://example.org', 'primaria', null],
  );
  return id;
}

async function publish(db: TestDb, user: string, topic: string, url = 'https://example.org/post') {
  return db.as(user).query('select public.publish_topic($1,$2)', [topic, url]);
}

describe('cancello editoriale', () => {
  test('elenca le dieci spunte e la rilettura mancanti', async () => {
    const { db, topic, marco } = await setup();
    expect(await status(db, marco, topic)).toEqual({ ok: false, missing: [...verification, ...legal, 'fonti', 'rilettura'] });
  });

  test('non pubblica senza fonti anche con spunte e rilettura', async () => {
    const { db, topic, marco, giulia } = await setup();
    for (const item of verification) await check(db, giulia, topic, 'verifica', item);
    for (const item of legal) await check(db, giulia, topic, 'legale', item);
    expect((await status(db, marco, topic)).missing).toEqual(['fonti', 'rilettura']);
    await expect(db.as(marco).query('select public.approve_review($1)', [topic]))
      .rejects.toMatchObject({ message: 'cancello_chiuso' });
    await db.admin.query('update public.topics set review_approved_by = $1, review_approved_at = now() where id = $2', [marco, topic]);
    expect((await status(db, marco, topic)).missing).toEqual(['fonti']);
    await expect(publish(db, giulia, topic)).rejects.toMatchObject({ message: 'cancello_chiuso' });
  });

  test('cancellare l’ultima fonte richiude il cancello', async () => {
    const { db, topic, marco, giulia } = await setup();
    await fill(db, giulia, topic);
    await db.as(marco).query('select public.approve_review($1)', [topic]);
    const [{ id }] = await db.admin.query<{ id: string }>('select id from public.sources where topic_id = $1', [topic]);
    await db.as(giulia).query('select public.delete_source($1)', [id]);
    expect((await status(db, marco, topic)).missing).toEqual(['fonti', 'rilettura']);
    await expect(publish(db, giulia, topic)).rejects.toMatchObject({ message: 'cancello_chiuso' });
  });

  test('rilettura richiede tutte le spunte e una fonte', async () => {
    const { db, topic, marco, giulia } = await setup();
    for (const item of verification) await check(db, giulia, topic, 'verifica', item);
    await addSource(db, giulia, topic);
    await expect(db.as(marco).query('select public.approve_review($1)', [topic]))
      .rejects.toMatchObject({ message: 'cancello_chiuso' });
  });

  test('aggiungere o rifare una spunta azzera la rilettura', async () => {
    const { db, topic, marco, giulia } = await setup();
    await fill(db, giulia, topic);
    await db.as(marco).query('select public.approve_review($1)', [topic]);
    await check(db, giulia, topic, 'legale', 'copyright');
    expect((await status(db, marco, topic)).missing).toEqual(['rilettura']);
  });

  test('aggiungere una fonte azzera la rilettura', async () => {
    const { db, topic, marco, giulia } = await setup();
    await fill(db, giulia, topic);
    await db.as(marco).query('select public.approve_review($1)', [topic]);
    await addSource(db, giulia, topic);
    expect((await status(db, marco, topic)).missing).toEqual(['rilettura']);
  });

  test('cinque passi portano a legale', async () => {
    const { db, topic, giulia } = await setup();
    for (const item of verification) await check(db, giulia, topic, 'verifica', item);
    expect(await db.admin.query('select stage from public.topics where id = $1', [topic])).toEqual([{ stage: 'legale' }]);
    await check(db, giulia, topic, 'verifica', 'isolare', false);
    expect(await db.admin.query('select stage from public.topics where id = $1', [topic])).toEqual([{ stage: 'verifica' }]);
  });

  test('rilettura obbligatoria e solo il rilettore approva', async () => {
    const { db, topic, giulia, marco } = await setup();
    await fill(db, giulia, topic);
    await expect(publish(db, giulia, topic)).rejects.toMatchObject({ message: 'cancello_chiuso' });
    await expect(db.as(giulia).query('select public.approve_review($1)', [topic]))
      .rejects.toMatchObject({ message: 'non_autorizzato' });
    await db.as(marco).query('select public.approve_review($1)', [topic]);
    expect(await status(db, marco, topic)).toEqual({ ok: true, missing: [] });
  });

  test('cambio rilettore azzera anche gate_status', async () => {
    const { db, topic, marco, giulia, membro } = await setup();
    await fill(db, giulia, topic);
    await db.as(marco).query('select public.approve_review($1)', [topic]);
    await db.as(marco).query('select public.assign_people($1,$2,$3)', [topic, giulia, membro]);
    expect((await status(db, marco, topic)).missing).toContain('rilettura');
  });

  test('rilettore disattivato chiude il cancello', async () => {
    const { db, topic, marco, giulia, maintainer } = await setup();
    await fill(db, giulia, topic);
    await db.as(marco).query('select public.approve_review($1)', [topic]);
    expect(await status(db, giulia, topic)).toEqual({ ok: true, missing: [] });

    await db.as(maintainer).query('select public.set_active($1,$2)', [marco, false]);
    const gate = await status(db, giulia, topic);
    expect(gate.ok).toBe(false);
    expect(gate.missing).toContain('rilettore');
    expect(gate.missing).toContain('rilettura');
    await expect(publish(db, giulia, topic)).rejects.toMatchObject({ message: 'cancello_chiuso' });
  });

  test('scrittore disattivato chiude il cancello anche se pubblica il rilettore', async () => {
    const { db, topic, marco, giulia, maintainer } = await setup();
    await fill(db, giulia, topic);
    await db.as(marco).query('select public.approve_review($1)', [topic]);
    expect(await status(db, marco, topic)).toEqual({ ok: true, missing: [] });

    await db.as(maintainer).query('select public.set_active($1,$2)', [giulia, false]);
    const gate = await status(db, marco, topic);
    expect(gate.ok).toBe(false);
    expect(gate.missing).toContain('scrittore');
    await expect(publish(db, marco, topic)).rejects.toMatchObject({ message: 'cancello_chiuso' });
  });

  test('spunta tolta azzera la rilettura e blocca la pubblicazione', async () => {
    const { db, topic, marco, giulia } = await setup();
    await fill(db, giulia, topic);
    await db.as(marco).query('select public.approve_review($1)', [topic]);
    await check(db, giulia, topic, 'legale', 'copyright', false);
    expect((await status(db, marco, topic)).missing).toEqual(['copyright', 'rilettura']);
    await expect(publish(db, giulia, topic)).rejects.toMatchObject({ message: 'cancello_chiuso' });
  });

  test('pubblica a cancello verde una sola volta', async () => {
    const { db, topic, marco, giulia } = await setup();
    await fill(db, giulia, topic);
    await db.as(marco).query('select public.approve_review($1)', [topic]);
    await publish(db, giulia, topic);
    await publish(db, giulia, topic);
    expect(await db.admin.query('select stage, published_at is not null as published from public.topics where id = $1', [topic]))
      .toEqual([{ stage: 'pubblicato', published: true }]);
    expect(await db.admin.query("select kind from public.events where topic_id = $1 and kind = 'pubblicato'", [topic]))
      .toHaveLength(1);
    await expect(publish(db, giulia, topic, 'https://example.org/other'))
      .rejects.toMatchObject({ message: 'fase_sbagliata' });
  });

  test('un membro non assegnato e il manutentore non pubblicano', async () => {
    const { db, topic, membro, maintainer } = await setup();
    for (const user of [membro, maintainer]) {
      await expect(publish(db, user, topic)).rejects.toMatchObject({ message: 'non_autorizzato' });
    }
  });

  test('manutentore escluso da spunte, rilettura, fonti e rettifiche', async () => {
    const { db, topic, maintainer, giulia, marco } = await setup();
    await expect(check(db, maintainer, topic, 'verifica', 'isolare'))
      .rejects.toMatchObject({ message: 'non_autorizzato' });
    await expect(db.as(maintainer).query('select public.approve_review($1)', [topic]))
      .rejects.toMatchObject({ message: 'non_autorizzato' });
    await expect(db.as(maintainer).query('select public.add_source($1,$2,$3,$4,$5)',
      [topic, 'Fonte', 'https://example.org', 'primaria', null]))
      .rejects.toMatchObject({ message: 'non_autorizzato' });
    await fill(db, giulia, topic);
    await db.as(marco).query('select public.approve_review($1)', [topic]);
    await publish(db, giulia, topic);
    await expect(db.as(maintainer).query('select public.add_correction($1,$2,$3,$4)',
      [topic, 'Corpo', 'Motivo', null]))
      .rejects.toMatchObject({ message: 'non_autorizzato' });
  });

  test('fonte cancellata solo dall’autore e mai dopo la pubblicazione', async () => {
    const { db, topic, giulia, marco } = await setup();
    const [{ id }] = await db.as(giulia).query<{ id: string }>(
      'select public.add_source($1,$2,$3,$4,$5) as id',
      [topic, 'Fonte', 'https://example.org', 'primaria', null],
    );
    await expect(db.as(marco).query('select public.delete_source($1)', [id]))
      .rejects.toMatchObject({ message: 'non_autorizzato' });
    const [{ id: temporary }] = await db.as(giulia).query<{ id: string }>(
      'select public.add_source($1,$2,$3,$4,$5) as id',
      [topic, 'Temporanea', 'https://example.org/temp', 'secondaria', null],
    );
    await db.as(giulia).query('select public.delete_source($1)', [temporary]);
    expect(await db.admin.query('select id from public.sources where id = $1', [temporary])).toEqual([]);
    await fill(db, giulia, topic);
    await db.as(marco).query('select public.approve_review($1)', [topic]);
    await publish(db, giulia, topic);
    await expect(db.as(giulia).query('select public.delete_source($1)', [id]))
      .rejects.toMatchObject({ message: 'fase_sbagliata' });
  });

  test('URL non https e host interni rifiutati in tutte le RPC', async () => {
    const { db, topic, giulia, marco } = await setup();
    await fill(db, giulia, topic);
    await db.as(marco).query('select public.approve_review($1)', [topic]);
    for (const url of ['http://example.org', 'javascript:alert(1)', 'https://localhost/a', 'https://169.254.169.254/a', 'https://service.internal/a']) {
      await expect(db.as(giulia).query('select public.add_source($1,$2,$3,$4,$5)', [topic, 'Fonte', url, 'primaria', null]))
        .rejects.toMatchObject({ message: 'dati_non_validi' });
      await expect(publish(db, giulia, topic, url)).rejects.toMatchObject({ message: 'dati_non_validi' });
    }
    await publish(db, giulia, topic);
    for (const url of ['http://example.org', 'javascript:alert(1)', 'https://localhost/a', 'https://169.254.169.254/a', 'https://service.internal/a']) {
      await expect(db.as(giulia).query('select public.add_correction($1,$2,$3,$4)', [topic, 'Corpo', 'Motivo', url]))
        .rejects.toMatchObject({ message: 'dati_non_validi' });
    }
  });

  test('screenshot_path vincolato al tema e al formato', async () => {
    const { db, topic, giulia } = await setup();
    const id = '11111111-1111-4111-8111-111111111111';
    const good = `${topic}/${id}.webp`;
    const [{ id: source }] = await db.as(giulia).query<{ id: string }>(
      'select public.add_source($1,$2,$3,$4,$5) as id', [topic, 'Fonte', 'https://example.org', 'primaria', good],
    );
    expect(await db.admin.query('select screenshot_path from public.sources where id = $1', [source]))
      .toEqual([{ screenshot_path: good }]);
    for (const path of [`00000000-0000-0000-0000-000000000099/${id}.png`, `${topic}/../${id}.png`, `${topic}/${id}.gif`]) {
      await expect(db.as(giulia).query('select public.add_source($1,$2,$3,$4,$5)',
        [topic, 'Fonte', 'https://example.org', 'primaria', path]))
        .rejects.toMatchObject({ message: 'dati_non_validi' });
    }
  });

  test('chiave sconosciuta e fase sbagliata danno errori di dominio', async () => {
    const { db, topic, giulia } = await setup(false);
    await expect(check(db, giulia, topic, 'verifica', 'isolare'))
      .rejects.toMatchObject({ message: 'fase_sbagliata' });
    await db.as(giulia).query('select public.cast_vote($1,true)', [topic]);
    const marco = '00000000-0000-0000-0000-000000000002';
    await db.as(marco).query('select public.cast_vote($1,true)', [topic]);
    await expect(check(db, giulia, topic, 'verifica', 'sconosciuta'))
      .rejects.toMatchObject({ message: 'dati_non_validi' });
    await db.admin.query("update public.topics set stage = 'pubblicato' where id = $1", [topic]);
    await expect(check(db, giulia, topic, 'verifica', 'isolare'))
      .rejects.toMatchObject({ message: 'fase_sbagliata' });
  });

  test('rettifiche append-only, nuovo URL e vecchio URL nell’evento', async () => {
    const { db, topic, giulia, marco } = await setup();
    await fill(db, giulia, topic);
    await db.as(marco).query('select public.approve_review($1)', [topic]);
    await publish(db, giulia, topic);
    await db.as(marco).query('select public.add_correction($1,$2,$3,$4)',
      [topic, '  Corpo  ', '  Motivo  ', 'https://example.org/new']);
    expect(await db.admin.query('select body, reason from public.corrections where topic_id = $1', [topic]))
      .toEqual([{ body: 'Corpo', reason: 'Motivo' }]);
    expect(await db.admin.query('select post_url from public.topics where id = $1', [topic]))
      .toEqual([{ post_url: 'https://example.org/new' }]);
    const [event] = await db.admin.query<{ data: { old_post_url: string } }>(
      "select data from public.events where topic_id = $1 and kind = 'rettifica'", [topic],
    );
    expect(event.data.old_post_url).toBe('https://example.org/post');
    await expect(db.as(marco).query('delete from public.corrections where topic_id = $1', [topic]))
      .rejects.toMatchObject({ code: '42501' });
  });

  test('testi invisibili e bidi rifiutati', async () => {
    const { db, topic, giulia, marco } = await setup();
    for (const title of ['\u200b', 'Titolo\u202e']) {
      await expect(db.as(giulia).query('select public.add_source($1,$2,$3,$4,$5)',
        [topic, title, 'https://example.org', 'primaria', null]))
        .rejects.toMatchObject({ message: 'dati_non_validi' });
    }
    await fill(db, giulia, topic);
    await db.as(marco).query('select public.approve_review($1)', [topic]);
    await publish(db, giulia, topic);
    for (const body of ['\u200b', 'Corpo\u202e']) {
      await expect(db.as(giulia).query('select public.add_correction($1,$2,$3,$4)',
        [topic, body, 'Motivo', null]))
        .rejects.toMatchObject({ message: 'dati_non_validi' });
    }
    await expect(db.as(giulia).query('select public.add_correction($1,$2,$3,$4)',
      [topic, 'Corpo', '\u200b', null]))
      .rejects.toMatchObject({ message: 'dati_non_validi' });
  });

  test('solo RPC possono scrivere e permessi funzioni espliciti', async () => {
    const { db, topic, marco } = await setup();
    for (const table of ['checks', 'sources', 'corrections']) {
      const [{ allowed }] = await db.admin.query<{ allowed: boolean }>(
        'select has_table_privilege($1,$2,$3) as allowed', ['authenticated', `public.${table}`, 'INSERT,UPDATE,DELETE'],
      );
      expect(allowed).toBe(false);
    }
    for (const signature of [
      'public.toggle_check(uuid,text,text,boolean)', 'public.add_source(uuid,text,text,text,text)',
      'public.delete_source(uuid)', 'public.approve_review(uuid)', 'public.gate_status(uuid)',
      'public.publish_topic(uuid,text)', 'public.add_correction(uuid,text,text,text)',
    ]) {
      for (const role of ['anon', 'authenticated']) {
        const [{ allowed }] = await db.admin.query<{ allowed: boolean }>(
          'select has_function_privilege($1,$2,$3) as allowed', [role, signature, 'EXECUTE'],
        );
        expect(allowed).toBe(role === 'authenticated');
      }
    }
    expect((await status(db, marco, topic)).ok).toBe(false);
  });
});
