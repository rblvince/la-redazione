import { describe, expect, test } from 'vitest';
import { createDb } from './harness';
import { seedPeople } from './fixtures';

const hash = (digit: string) => digit.repeat(64);
const newUser = '00000000-0000-0000-0000-000000000099';

async function setup() {
  const db = await createDb();
  const people = await seedPeople(db);
  return { db, ...people };
}

async function invite(db: Awaited<ReturnType<typeof createDb>>, actor: string, email = 'nuovo@example.test', token = hash('a')) {
  const [row] = await db.as(actor).query<{ id: string }>('select public.create_invite($1,$2,$3) as id', [email, 'membro', token]);
  return row.id;
}

describe('inviti e amministrazione', () => {
  test('membro non può invitare', async () => {
    const { db, membro } = await setup();
    await expect(invite(db, membro)).rejects.toMatchObject({ code: 'P0001', message: 'non_autorizzato' });
  });

  test('decisore invita, invito riscattato una volta sola', async () => {
    const { db, marco } = await setup();
    await invite(db, marco);
    await db.admin.query('insert into auth.users (id,email) values ($1,$2)', [newUser, 'nuovo@example.test']);
    expect(await db.admin.query('select public.redeem_invite($1,$2,$3,$4) as role', [hash('a'), newUser, 'nuovo@example.test', 'Nuovo']))
      .toEqual([{ role: 'membro' }]);
    await expect(db.admin.query('select public.redeem_invite($1,$2,$3,$4)', [hash('a'), newUser, 'nuovo@example.test', 'Nuovo']))
      .rejects.toMatchObject({ code: 'P0001', message: 'invito_usato' });
    expect((await db.admin.query('select id from public.profiles where email = $1', ['nuovo@example.test']))).toHaveLength(1);
  });

  test('invito scaduto', async () => {
    const { db, marco } = await setup();
    const id = await invite(db, marco);
    await db.admin.query("update public.invites set expires_at = now() - interval '1 second' where id = $1", [id]);
    await expect(db.admin.query('select public.redeem_invite($1,$2,$3,$4)', [hash('a'), newUser, 'nuovo@example.test', 'Nuovo']))
      .rejects.toMatchObject({ message: 'invito_scaduto' });
  });

  test('invito revocato', async () => {
    const { db, marco } = await setup();
    const id = await invite(db, marco);
    await db.as(marco).query('select public.revoke_invite($1)', [id]);
    await expect(db.admin.query('select public.redeem_invite($1,$2,$3,$4)', [hash('a'), newUser, 'nuovo@example.test', 'Nuovo']))
      .rejects.toMatchObject({ message: 'invito_non_valido' });
  });

  test('decisore retrocesso non può revocare il proprio invito', async () => {
    const { db, marco, maintainer } = await setup();
    const id = await invite(db, marco);
    await db.as(maintainer).query('select public.set_role($1,$2)', [marco, 'membro']);
    await expect(db.as(marco).query('select public.revoke_invite($1)', [id]))
      .rejects.toMatchObject({ message: 'non_autorizzato' });
  });

  test('email diversa', async () => {
    const { db, marco } = await setup();
    await invite(db, marco);
    await expect(db.admin.query('select public.redeem_invite($1,$2,$3,$4)', [hash('a'), newUser, 'altro@example.test', 'Nuovo']))
      .rejects.toMatchObject({ message: 'email_diversa' });
    expect(await db.admin.query('select id from public.profiles where id = $1', [newUser])).toEqual([]);
  });

  test('authenticated non può chiamare redeem_invite', async () => {
    const { db, marco } = await setup();
    await expect(db.as(marco).query('select public.redeem_invite($1,$2,$3,$4)', [hash('a'), newUser, 'nuovo@example.test', 'Nuovo']))
      .rejects.toMatchObject({ code: '42501' });
  });

  test('solo il manutentore cambia ruoli', async () => {
    const { db, maintainer, marco, giulia } = await setup();
    await expect(db.as(marco).query('select public.set_role($1,$2)', [giulia, 'membro']))
      .rejects.toMatchObject({ message: 'non_autorizzato' });
    await db.as(maintainer).query('select public.set_role($1,$2)', [giulia, 'membro']);
    expect(await db.admin.query('select role from public.profiles where id = $1', [giulia])).toEqual([{ role: 'membro' }]);
  });

  test('regola di decisione valida', async () => {
    const { db, maintainer } = await setup();
    await expect(db.as(maintainer).query('select public.set_decision_rule($1)', ['a_caso']))
      .rejects.toMatchObject({ message: 'dati_non_validi' });
  });

  test('privilegi mirati di ogni nuova funzione', async () => {
    const { db } = await setup();
    const signatures = [
      ['public.create_invite(text,text,text)', 'authenticated'],
      ['public.revoke_invite(uuid)', 'authenticated'],
      ['public.set_role(uuid,text)', 'authenticated'],
      ['public.set_active(uuid,boolean)', 'authenticated'],
      ['public.set_decision_rule(text)', 'authenticated'],
      ['public.set_stale_days(integer)', 'authenticated'],
      ['public.peek_invite(text,text)', 'service_role'],
      ['public.redeem_invite(text,uuid,text,text)', 'service_role'],
      ['app.reevaluate_open_topics()', 'none'],
    ];
    for (const [signature, granted] of signatures) {
      for (const role of ['anon', 'authenticated', 'service_role']) {
        const [{ allowed }] = await db.admin.query<{ allowed: boolean }>('select has_function_privilege($1,$2,$3) as allowed', [role, signature, 'EXECUTE']);
        expect(allowed, `${role} ${signature}`).toBe(role === granted);
      }
    }
  });

  test('peek_invite non scrive e controlla validità ed email', async () => {
    const { db, marco } = await setup();
    const id = await invite(db, marco);
    const before = await db.admin.query('select id from public.events');
    expect(await db.admin.query('select public.peek_invite($1,$2) as email', [hash('a'), 'nuovo@example.test']))
      .toEqual([{ email: 'nuovo@example.test' }]);
    expect(await db.admin.query('select used_at, revoked_at from public.invites where id = $1', [id]))
      .toEqual([{ used_at: null, revoked_at: null }]);
    expect(await db.admin.query('select id from public.events')).toEqual(before);
    await expect(db.admin.query('select public.peek_invite($1,$2)', [hash('a'), 'altro@example.test']))
      .rejects.toMatchObject({ message: 'email_diversa' });
  });

  test('create_invite revoca il precedente aperto per la stessa email', async () => {
    const { db, marco } = await setup();
    const first = await invite(db, marco);
    await invite(db, marco, ' NUOVO@EXAMPLE.TEST ', hash('b'));
    expect(await db.admin.query('select email, revoked_at is not null as revoked from public.invites where id = $1', [first]))
      .toEqual([{ email: 'nuovo@example.test', revoked: true }]);
    expect(await db.admin.query('select email from public.invites where token_hash = $1', [hash('b')]))
      .toEqual([{ email: 'nuovo@example.test' }]);
    expect(await db.admin.query('select kind from public.events order by id'))
      .toEqual([{ kind: 'invito_creato' }, { kind: 'invito_revocato' }, { kind: 'invito_creato' }]);
  });

  test('due create_invite consecutive lasciano un solo invito aperto e il vincolo rifiuta un secondo inserimento diretto', async () => {
    const { db, marco } = await setup();
    await invite(db, marco, 'nuovo@example.test', hash('a'));
    await invite(db, marco, 'nuovo@example.test', hash('b'));
    expect(await db.admin.query('select token_hash from public.invites where email = $1 and used_at is null and revoked_at is null', ['nuovo@example.test']))
      .toEqual([{ token_hash: hash('b') }]);
    await expect(db.admin.query(
      'insert into public.invites (email, role, token_hash, invited_by) values ($1,$2,$3,$4)',
      ['nuovo@example.test', 'membro', hash('c'), marco],
    )).rejects.toMatchObject({ code: '23505' });
  });

  test('invito_creato non espone email negli eventi', async () => {
    const { db, marco } = await setup();
    const email = 'nuovo@example.test';
    await invite(db, marco, email);
    expect(await db.admin.query('select id from public.events where data::text like $1', [`%${email}%`])).toEqual([]);
  });

  test('invito del manutentore non espone il suo id', async () => {
    const { db, maintainer, marco } = await setup();
    await invite(db, maintainer);
    const events = await db.as(marco).query('select actor_id, data from public.events');
    expect(JSON.stringify(events)).not.toContain(maintainer);
    await expect(db.as(marco).query('select invited_by from public.invites'))
      .rejects.toMatchObject({ code: '42501' });
    expect(await db.admin.query('select actor_id from app.audit_log'))
      .toEqual([{ actor_id: maintainer }]);
  });

  test('set_decision_rule richiama reevaluate_open_topics', async () => {
    const { db, maintainer } = await setup();
    await db.admin.query(`create or replace function app.reevaluate_open_topics()
      returns void language plpgsql security definer set search_path = '' as $$
      begin
        insert into public.events (topic_id, actor_id, kind, data)
          values (null, auth.uid(), 'rivalutazione_test', '{}'::jsonb);
      end $$`);
    await db.as(maintainer).query('select public.set_decision_rule($1)', ['maggioranza']);
    expect(await db.admin.query("select kind from public.events where kind = 'rivalutazione_test'"))
      .toEqual([{ kind: 'rivalutazione_test' }]);
  });

  test('membro disattivato riceve non_autorizzato da create_invite', async () => {
    const { db, marco } = await setup();
    await db.admin.query('update public.profiles set active = false where id = $1', [marco]);
    await expect(invite(db, marco)).rejects.toMatchObject({ message: 'non_autorizzato' });
  });

  test('email già registrata, ruolo e hash non validi sono respinti', async () => {
    const { db, marco } = await setup();
    for (const [email, role, token] of [
      ['Giulia@example.test', 'membro', hash('a')],
      ['nuovo@example.test', 'manutentore', hash('b')],
      ['nuovo@example.test', 'membro', 'troppo-corto'],
    ]) {
      await expect(db.as(marco).query('select public.create_invite($1,$2,$3)', [email, role, token]))
        .rejects.toMatchObject({ message: 'dati_non_validi' });
    }
  });

  test('manutentore non disattiva sé stesso né cambia il proprio ruolo', async () => {
    const { db, maintainer } = await setup();
    await expect(db.as(maintainer).query('select public.set_active($1,$2)', [maintainer, false]))
      .rejects.toMatchObject({ message: 'dati_non_validi' });
    await expect(db.as(maintainer).query('select public.set_role($1,$2)', [maintainer, 'membro']))
      .rejects.toMatchObject({ message: 'dati_non_validi' });
  });

  test('eventi amministrativi non contengono token_hash', async () => {
    const { db, marco } = await setup();
    await invite(db, marco);
    await db.admin.query('insert into auth.users (id,email) values ($1,$2)', [newUser, 'nuovo@example.test']);
    await db.admin.query('select public.redeem_invite($1,$2,$3,$4)', [hash('a'), newUser, 'nuovo@example.test', 'Nuovo']);
    const rows = await db.admin.query<{ kind: string; actor_id: string; data: unknown }>('select kind, actor_id, data from public.events');
    expect(rows[0].kind).toBe('invito_creato');
    expect(rows[0].actor_id).toBe(marco);
    expect(rows[1].kind).toBe('invito_usato');
    expect(JSON.stringify(rows)).not.toContain(hash('a'));
    expect(JSON.stringify(rows)).not.toContain('token_hash');
  });
});
