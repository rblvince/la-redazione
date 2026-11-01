-- Audit rows are private to the service key. The foreign key is deferred because
-- the BEFORE INSERT trigger records the real actor before its event exists.
create table app.audit_log (
  event_id bigint primary key references public.events(id) on delete cascade deferrable initially deferred,
  actor_id uuid not null references public.profiles(id) on delete restrict
);
alter table app.audit_log enable row level security;
revoke all on app.audit_log from public, anon, authenticated;
grant usage on schema app to service_role;
grant select on app.audit_log to service_role;

-- Centralized on events so later RPCs cannot accidentally reveal the maintainer.
create function app.hide_maintainer_event()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_actor uuid;
begin
  v_actor := coalesce(v_caller, new.actor_id);
  if v_actor is not null then
    insert into app.audit_log (event_id, actor_id) values (new.id, v_actor);
  end if;

  if exists (
    select 1 from public.profiles as p
    where p.role = 'manutentore' and p.id in (v_caller, new.actor_id)
  ) then
    new.actor_id := null;
  end if;

  -- Fail closed if any event payload names a maintainer, including future kinds.
  if exists (
    select 1 from public.profiles as p
    where p.role = 'manutentore'
      and pg_catalog.strpos(pg_catalog.lower(new.data::text), p.id::text) > 0
  ) then
    raise exception using errcode = 'P0001', message = 'dati_non_validi';
  end if;
  return new;
end $$;
revoke all on function app.hide_maintainer_event() from public, anon, authenticated;

create trigger hide_maintainer_event_before_insert
before insert on public.events
for each row execute function app.hide_maintainer_event();

-- Preserve provenance for events written before this migration was applied.
insert into app.audit_log (event_id, actor_id)
  select e.id, e.actor_id from public.events as e
  join public.profiles as p on p.id = e.actor_id
  where p.role = 'manutentore';
update public.events as e set actor_id = null
  from public.profiles as p
  where p.id = e.actor_id and p.role = 'manutentore';

-- Decisors can list invitations, but the creator ID is not needed by the client.
revoke select (invited_by) on public.invites from authenticated;

create or replace function app.evaluate_decision(p_topic uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_stage text;
  v_round integer;
  v_rule text;
  v_deciders integer;
  v_yes integer;
begin
  select t.stage, t.round into v_stage, v_round
    from public.topics as t where t.id = p_topic for update;
  if not found or v_stage <> 'da_decidere' then
    return;
  end if;

  select s.decision_rule into v_rule from public.settings as s where s.id = 1;
  select pg_catalog.count(*)::integer,
         pg_catalog.count(*) filter (where v.value is true)::integer
    into v_deciders, v_yes
    from public.profiles as p
    left join public.votes as v
      on v.voter_id = p.id and v.topic_id = p_topic and v.round = v_round
    where p.role = 'decisore' and p.active;

  if v_deciders > 0 and (
    (v_rule = 'unanimita' and v_yes = v_deciders)
    or (v_rule = 'maggioranza' and v_yes > v_deciders / 2.0)
  ) then
    update public.topics as t
      set stage = 'verifica', decided_at = pg_catalog.clock_timestamp(),
          last_activity_at = pg_catalog.clock_timestamp()
      where t.id = p_topic;
    insert into public.events (topic_id, actor_id, kind, data)
      values (p_topic, p_actor, 'deciso',
        pg_catalog.jsonb_build_object('round', v_round, 'rule', v_rule));
  end if;
end $$;
revoke all on function app.evaluate_decision(uuid,uuid) from public, anon, authenticated;
