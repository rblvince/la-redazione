import { describe, expect, test } from 'vitest';
import { createDb, type TestDb } from './harness';
import { seedPeople } from './fixtures';

async function setup() {
  const db = await createDb();
  const people = await seedPeople(db);
  const [topic] = await db.as(people.membro).query<{ id: string }>(
    'select public.propose_topic($1,$2,$3,$4,$5) as id',
    ['Tema', null, null, null, null],
  );
  return { db, topic: topic.id, ...people };
}

async function vote(db: TestDb, user: string, topic: string, value: boolean) {
  const [row] = await db.as(user).query<{ stage: string }>(
    'select public.cast_vote($1,$2) as stage', [topic, value],
  );
  return row.stage;
}

async function stage(db: TestDb, topic: string) {
  const [row] = await db.admin.query<{ stage: string; round: number; decided_at: string | null }>(
    'select stage, round, decided_at from public.topics where id = $1', [topic],
  );
  return row;
}

async function decisions(db: TestDb, topic: string) {
  return db.admin.query<{ actor_id: string | null; data: Record<string, unknown> }>(
    "select actor_id, data from public.events where topic_id = $1 and kind = 'deciso'", [topic],
  );
}

describe('voto e decisione', () => {
  test('due sì passano e producono un solo evento deciso', async () => {
    const { db, topic, marco, giulia } = await setup();
    expect(await vote(db, marco, topic, true)).toBe('da_decidere');
    expect(await vote(db, giulia, topic, true)).toBe('verifica');
    expect(await stage(db, topic)).toMatchObject({ stage: 'verifica', round: 1 });
    expect((await stage(db, topic)).decided_at).not.toBeNull();
    expect(await decisions(db, topic)).toHaveLength(1);
  });

  test('un no tiene in discussione', async () => {
    const { db, topic, marco, giulia } = await setup();
    await vote(db, marco, topic, true);
    expect(await vote(db, giulia, topic, false)).toBe('da_decidere');
    expect((await stage(db, topic)).decided_at).toBeNull();
    expect(await decisions(db, topic)).toHaveLength(0);
  });

  test('il voto si cambia senza aggiungere una riga', async () => {
    const { db, topic, marco, giulia } = await setup();
    await vote(db, marco, topic, false);
    await vote(db, marco, topic, true);
    expect(await db.admin.query('select voter_id, value from public.votes where topic_id = $1', [topic]))
      .toEqual([{ voter_id: marco, value: true }]);
    expect(await vote(db, giulia, topic, true)).toBe('verifica');
  });

  test('membro e manutentore non votano', async () => {
    const { db, topic, membro, maintainer } = await setup();
    for (const user of [membro, maintainer]) {
      await expect(vote(db, user, topic, true)).rejects.toMatchObject({ message: 'non_autorizzato' });
    }
  });

  test('un decisore declassato non vota come membro, neanche se poi è ripromosso', async () => {
    const { db, topic, marco, maintainer } = await setup();
    await db.as(maintainer).query('select public.set_role($1,$2)', [marco, 'membro']);
    await expect(vote(db, marco, topic, true)).rejects.toMatchObject({ message: 'non_autorizzato' });
    await db.as(maintainer).query('select public.set_role($1,$2)', [marco, 'decisore']);
    expect(await db.admin.query('select voter_id from public.votes where topic_id = $1', [topic]))
      .toEqual([]);
    expect((await stage(db, topic)).stage).toBe('da_decidere');
  });

  test('senza decisori il tema non passa', async () => {
    const { db, topic, marco, giulia, maintainer } = await setup();
    await db.as(maintainer).query('select public.set_role($1,$2)', [marco, 'membro']);
    await db.as(maintainer).query('select public.set_role($1,$2)', [giulia, 'membro']);
    await db.admin.query('select app.evaluate_decision($1,$2)', [topic, null]);
    expect((await stage(db, topic)).stage).toBe('da_decidere');
    expect(await decisions(db, topic)).toHaveLength(0);
  });

  test('il voto di un ex decisore non conta', async () => {
    const { db, topic, marco, giulia, membro, maintainer } = await setup();
    await db.as(maintainer).query('select public.set_role($1,$2)', [membro, 'decisore']);
    await vote(db, marco, topic, true);
    await db.as(maintainer).query('select public.set_role($1,$2)', [marco, 'membro']);
    expect(await vote(db, giulia, topic, true)).toBe('da_decidere');
    expect(await vote(db, membro, topic, true)).toBe('verifica');
  });

  test('maggioranza di quattro decisori richiede tre sì', async () => {
    const { db, topic, marco, giulia, membro, maintainer } = await setup();
    const quarto = '00000000-0000-0000-0000-000000000005';
    await db.admin.query('insert into auth.users (id, email) values ($1,$2)', [quarto, 'quarto@example.test']);
    await db.admin.query(
      'insert into public.profiles (id, display_name, email, role) values ($1,$2,$3,$4)',
      [quarto, 'Quarto', 'quarto@example.test', 'decisore'],
    );
    await db.as(maintainer).query('select public.set_role($1,$2)', [membro, 'decisore']);
    await db.as(maintainer).query('select public.set_decision_rule($1)', ['maggioranza']);
    await vote(db, marco, topic, true);
    expect(await vote(db, giulia, topic, true)).toBe('da_decidere');
    expect(await vote(db, membro, topic, true)).toBe('verifica');
    expect(await decisions(db, topic)).toHaveLength(1);
  });

  test('decisore disattivato a voto aperto sblocca subito', async () => {
    const { db, topic, marco, giulia, maintainer } = await setup();
    await vote(db, marco, topic, true);
    await db.as(maintainer).query('select public.set_active($1,$2)', [giulia, false]);
    expect((await stage(db, topic)).stage).toBe('verifica');
    expect(await decisions(db, topic)).toHaveLength(1);
  });

  test('nuovo decisore riapre il conteggio prima della decisione', async () => {
    const { db, topic, marco, giulia, membro, maintainer } = await setup();
    await db.as(maintainer).query('select public.set_role($1,$2)', [membro, 'decisore']);
    await vote(db, marco, topic, true);
    await db.as(maintainer).query('select public.set_active($1,$2)', [giulia, false]);
    expect((await stage(db, topic)).stage).toBe('da_decidere');
    expect(await vote(db, membro, topic, true)).toBe('verifica');
  });

  test('cambio regola sblocca e scrive deciso', async () => {
    const { db, topic, marco, giulia, membro, maintainer } = await setup();
    await db.as(maintainer).query('select public.set_role($1,$2)', [membro, 'decisore']);
    await vote(db, marco, topic, true);
    await vote(db, giulia, topic, true);
    expect((await stage(db, topic)).stage).toBe('da_decidere');
    await db.as(maintainer).query('select public.set_decision_rule($1)', ['maggioranza']);
    expect((await stage(db, topic)).stage).toBe('verifica');
    expect(await decisions(db, topic)).toHaveLength(1);
  });

  test('cambio ruolo del decisore mancante sblocca', async () => {
    const { db, topic, marco, giulia, maintainer } = await setup();
    await vote(db, marco, topic, true);
    await db.as(maintainer).query('select public.set_role($1,$2)', [giulia, 'membro']);
    expect((await stage(db, topic)).stage).toBe('verifica');
  });

  test('due voti concorrenti dello stesso decisore lasciano una riga', async () => {
    const { db, topic, marco } = await setup();
    await Promise.all([vote(db, marco, topic, false), vote(db, marco, topic, true)]);
    expect(await db.admin.query('select count(*)::int as count from public.votes where topic_id = $1', [topic]))
      .toEqual([{ count: 1 }]);
  });

  test('evaluate è idempotente dopo il passaggio a verifica', async () => {
    const { db, topic, marco, giulia } = await setup();
    await vote(db, marco, topic, true);
    await vote(db, giulia, topic, true);
    await db.admin.query('select app.evaluate_decision($1,$2)', [topic, null]);
    await db.admin.query('select app.evaluate_decision($1,$2)', [topic, null]);
    expect(await decisions(db, topic)).toHaveLength(1);
  });

  test('cast_vote fuori da da_decidere dà fase_sbagliata', async () => {
    const { db, topic, marco } = await setup();
    await db.as(marco).query('select public.park_topic($1)', [topic]);
    await expect(vote(db, marco, topic, true)).rejects.toMatchObject({ message: 'fase_sbagliata' });
  });

  test('parcheggio e riattivazione incrementano round e ignorano i voti vecchi', async () => {
    const { db, topic, marco, giulia, membro } = await setup();
    await vote(db, marco, topic, true);
    await db.as(giulia).query('select public.park_topic($1)', [topic]);
    expect((await stage(db, topic)).stage).toBe('parcheggiato');
    await db.as(membro).query('select public.reactivate_topic($1)', [topic]);
    expect(await stage(db, topic)).toMatchObject({ stage: 'da_decidere', round: 2 });
    expect(await vote(db, giulia, topic, true)).toBe('da_decidere');
    expect(await vote(db, marco, topic, true)).toBe('verifica');
    expect(await db.admin.query('select round from public.votes where topic_id = $1 order by round', [topic]))
      .toEqual([{ round: 1 }, { round: 2 }, { round: 2 }]);
  });

  test('assegnazione rifiuta stesse persone e manutentore', async () => {
    const { db, topic, marco, giulia, maintainer } = await setup();
    await vote(db, marco, topic, true);
    await vote(db, giulia, topic, true);
    await expect(db.as(marco).query('select public.assign_people($1,$2,$3)', [topic, marco, marco]))
      .rejects.toMatchObject({ message: 'stesse_persone' });
    await expect(db.as(marco).query('select public.assign_people($1,$2,$3)', [topic, maintainer, marco]))
      .rejects.toMatchObject({ message: 'dati_non_validi' });
  });

  test('assegnazione rifiuta una persona disattivata', async () => {
    const { db, topic, marco, giulia, membro, maintainer } = await setup();
    await vote(db, marco, topic, true);
    await vote(db, giulia, topic, true);
    await db.as(maintainer).query('select public.set_active($1,$2)', [membro, false]);
    await expect(db.as(marco).query('select public.assign_people($1,$2,$3)', [topic, giulia, membro]))
      .rejects.toMatchObject({ message: 'dati_non_validi' });
    expect(await db.admin.query('select writer_id, reviewer_id from public.topics where id = $1', [topic]))
      .toEqual([{ writer_id: null, reviewer_id: null }]);
  });

  test('assegnazione valida e cambio rilettore azzera approvazione', async () => {
    const { db, topic, marco, giulia, membro } = await setup();
    await vote(db, marco, topic, true);
    await vote(db, giulia, topic, true);
    await db.as(marco).query('select public.assign_people($1,$2,$3)', [topic, marco, giulia]);
    await db.admin.query('update public.topics set review_approved_by = $1, review_approved_at = now() where id = $2', [giulia, topic]);
    await db.as(marco).query('select public.assign_people($1,$2,$3)', [topic, marco, membro]);
    expect(await db.admin.query('select writer_id, reviewer_id, review_approved_by, review_approved_at from public.topics where id = $1', [topic]))
      .toEqual([{ writer_id: marco, reviewer_id: membro, review_approved_by: null, review_approved_at: null }]);
  });

  test('cambio scrittore azzera la rilettura anche se il rilettore resta uguale', async () => {
    const { db, topic, marco, giulia, membro } = await setup();
    await vote(db, marco, topic, true);
    await vote(db, giulia, topic, true);
    await db.as(marco).query('select public.assign_people($1,$2,$3)', [topic, marco, giulia]);
    await db.admin.query('update public.topics set review_approved_by = $1, review_approved_at = now() where id = $2', [giulia, topic]);
    await db.as(marco).query('select public.assign_people($1,$2,$3)', [topic, membro, giulia]);
    expect(await db.admin.query('select writer_id, reviewer_id, review_approved_by, review_approved_at from public.topics where id = $1', [topic]))
      .toEqual([{ writer_id: membro, reviewer_id: giulia, review_approved_by: null, review_approved_at: null }]);
  });

  test.each(['set_decision_rule', 'set_active', 'set_role'])(
    '%s del manutentore non espone il suo id negli eventi e conserva audit privato', async (action) => {
      const { db, topic, marco, giulia, membro, maintainer } = await setup();
      if (action === 'set_decision_rule') {
        await db.as(maintainer).query('select public.set_role($1,$2)', [membro, 'decisore']);
        await vote(db, marco, topic, true);
        await vote(db, giulia, topic, true);
        await db.as(maintainer).query('select public.set_decision_rule($1)', ['maggioranza']);
      } else {
        await vote(db, marco, topic, true);
        if (action === 'set_active') {
          await db.as(maintainer).query('select public.set_active($1,$2)', [giulia, false]);
        } else {
          await db.as(maintainer).query('select public.set_role($1,$2)', [giulia, 'membro']);
        }
      }
      const events = await db.as(marco).query<{ id: number; actor_id: string | null; kind: string; data: unknown }>(
        'select * from public.events order by id',
      );
      expect(events.some((event) => event.kind === 'deciso')).toBe(true);
      expect(JSON.stringify(events)).not.toContain(maintainer);
      const adminEvents = events.filter((event) =>
        ['deciso', 'regola_cambiata', 'ruolo_cambiato', 'attivo_cambiato'].includes(event.kind));
      expect(adminEvents.every((event) => event.actor_id === null)).toBe(true);
      const audit = await db.admin.query<{ event_id: number; actor_id: string }>(
        'select event_id, actor_id from app.audit_log order by event_id',
      );
      expect(adminEvents.every((event) => audit.some((row) => row.event_id === event.id && row.actor_id === maintainer))).toBe(true);
      await expect(db.as(marco).query('select * from app.audit_log'))
        .rejects.toMatchObject({ code: '42501' });
      const [{ serviceCanRead }] = await db.admin.query<{ serviceCanRead: boolean }>(
        "select has_table_privilege('service_role', 'app.audit_log', 'SELECT') as \"serviceCanRead\"",
      );
      expect(serviceCanRead).toBe(true);
    },
  );

  test('solo authenticated esegue le RPC pubbliche e nessuno esegue quelle app', async () => {
    const { db } = await setup();
    for (const signature of [
      'public.cast_vote(uuid,boolean)', 'public.park_topic(uuid)',
      'public.reactivate_topic(uuid)', 'public.assign_people(uuid,uuid,uuid)',
      'app.evaluate_decision(uuid,uuid)', 'app.reevaluate_open_topics()',
    ]) {
      for (const role of ['anon', 'authenticated']) {
        const [{ allowed }] = await db.admin.query<{ allowed: boolean }>(
          'select has_function_privilege($1,$2,$3) as allowed', [role, signature, 'EXECUTE'],
        );
        expect(allowed, `${role} ${signature}`).toBe(role === 'authenticated' && signature.startsWith('public.'));
      }
    }
  });
});
