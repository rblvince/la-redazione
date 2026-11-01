-- Ordine globale dei lock di riga: settings -> profili (UUID crescente) -> temi.
-- Chi blocca piu temi li prende in ordine di UUID crescente.
create function app.evaluate_decision(p_topic uuid, p_actor uuid)
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

create or replace function app.reevaluate_open_topics()
returns void language plpgsql security definer set search_path = ''
as $$
declare v_topic uuid;
begin
  for v_topic in
    select t.id from public.topics as t where t.stage = 'da_decidere' order by t.id
  loop
    perform app.evaluate_decision(v_topic, null);
  end loop;
end $$;
revoke all on function app.reevaluate_open_topics() from public, anon, authenticated;

create function public.cast_vote(p_topic uuid, p_value boolean)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  v_stage text;
  v_round integer;
  v_active boolean;
  v_role text;
begin
  select p.active, p.role into v_active, v_role
    from public.profiles as p where p.id = auth.uid() for share;
  if not found or v_active is not true or v_role <> 'decisore' then
    raise exception using errcode = 'P0001', message = 'non_autorizzato';
  end if;
  if p_topic is null or p_value is null then
    raise exception using errcode = 'P0001', message = 'dati_non_validi';
  end if;

  select t.stage, t.round into v_stage, v_round
    from public.topics as t where t.id = p_topic for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'dati_non_validi';
  end if;
  if v_stage <> 'da_decidere' then
    raise exception using errcode = 'P0001', message = 'fase_sbagliata';
  end if;

  insert into public.votes (topic_id, voter_id, round, value)
    values (p_topic, auth.uid(), v_round, p_value)
    on conflict (topic_id, voter_id, round)
    do update set value = excluded.value, updated_at = pg_catalog.clock_timestamp();
  update public.topics as t set last_activity_at = pg_catalog.clock_timestamp() where t.id = p_topic;
  insert into public.events (topic_id, actor_id, kind, data)
    values (p_topic, auth.uid(), 'votato',
      pg_catalog.jsonb_build_object('round', v_round, 'value', p_value));
  perform app.evaluate_decision(p_topic, auth.uid());
  select t.stage into v_stage from public.topics as t where t.id = p_topic;
  return v_stage;
end $$;
revoke all on function public.cast_vote(uuid,boolean) from public, anon, authenticated;
grant execute on function public.cast_vote(uuid,boolean) to authenticated;

create function public.park_topic(p_topic uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_stage text;
declare v_active boolean;
declare v_role text;
begin
  select p.active, p.role into v_active, v_role
    from public.profiles as p where p.id = auth.uid() for share;
  if not found or v_active is not true or v_role <> 'decisore' then
    raise exception using errcode = 'P0001', message = 'non_autorizzato';
  end if;
  if p_topic is null then
    raise exception using errcode = 'P0001', message = 'dati_non_validi';
  end if;
  select t.stage into v_stage from public.topics as t where t.id = p_topic for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'dati_non_validi';
  end if;
  if v_stage <> 'da_decidere' then
    raise exception using errcode = 'P0001', message = 'fase_sbagliata';
  end if;
  update public.topics as t
    set stage = 'parcheggiato', last_activity_at = pg_catalog.clock_timestamp()
    where t.id = p_topic;
  insert into public.events (topic_id, actor_id, kind)
    values (p_topic, auth.uid(), 'parcheggiato');
end $$;
revoke all on function public.park_topic(uuid) from public, anon, authenticated;
grant execute on function public.park_topic(uuid) to authenticated;

create function public.reactivate_topic(p_topic uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_stage text;
declare v_round integer;
declare v_active boolean;
declare v_role text;
begin
  select p.active, p.role into v_active, v_role
    from public.profiles as p where p.id = auth.uid() for share;
  if not found or v_active is not true or v_role not in ('decisore', 'membro') then
    raise exception using errcode = 'P0001', message = 'non_autorizzato';
  end if;
  if p_topic is null then
    raise exception using errcode = 'P0001', message = 'dati_non_validi';
  end if;
  select t.stage, t.round into v_stage, v_round
    from public.topics as t where t.id = p_topic for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'dati_non_validi';
  end if;
  if v_stage <> 'parcheggiato' then
    raise exception using errcode = 'P0001', message = 'fase_sbagliata';
  end if;
  update public.topics as t
    set stage = 'da_decidere', round = v_round + 1, decided_at = null,
        last_activity_at = pg_catalog.clock_timestamp()
    where t.id = p_topic;
  insert into public.events (topic_id, actor_id, kind, data)
    values (p_topic, auth.uid(), 'riattivato',
      pg_catalog.jsonb_build_object('round', v_round + 1));
end $$;
revoke all on function public.reactivate_topic(uuid) from public, anon, authenticated;
grant execute on function public.reactivate_topic(uuid) to authenticated;

create function public.assign_people(p_topic uuid, p_writer uuid, p_reviewer uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_stage text;
  v_old_writer uuid;
  v_old_reviewer uuid;
  v_profile record;
  v_caller_authorized boolean := false;
  v_valid_assignees integer := 0;
begin
  for v_profile in
    select p.id, p.active, p.role from public.profiles as p
      where p.id in (auth.uid(), p_writer, p_reviewer)
      order by p.id for share
  loop
    if v_profile.id = auth.uid() then
      v_caller_authorized := v_profile.active and v_profile.role = 'decisore';
    end if;
    if v_profile.id in (p_writer, p_reviewer)
       and v_profile.active and v_profile.role <> 'manutentore' then
      v_valid_assignees := v_valid_assignees + 1;
    end if;
  end loop;
  if not v_caller_authorized then
    raise exception using errcode = 'P0001', message = 'non_autorizzato';
  end if;
  if p_topic is null or p_writer is null or p_reviewer is null then
    raise exception using errcode = 'P0001', message = 'dati_non_validi';
  end if;
  if p_writer = p_reviewer then
    raise exception using errcode = 'P0001', message = 'stesse_persone';
  end if;
  select t.stage, t.writer_id, t.reviewer_id into v_stage, v_old_writer, v_old_reviewer
    from public.topics as t where t.id = p_topic for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'dati_non_validi';
  end if;
  if v_stage not in ('verifica', 'legale') then
    raise exception using errcode = 'P0001', message = 'fase_sbagliata';
  end if;
  if v_valid_assignees <> 2 then
    raise exception using errcode = 'P0001', message = 'dati_non_validi';
  end if;
  update public.topics as t
    set writer_id = p_writer, reviewer_id = p_reviewer,
        review_approved_by = case when v_old_writer is distinct from p_writer or v_old_reviewer is distinct from p_reviewer then null else t.review_approved_by end,
        review_approved_at = case when v_old_writer is distinct from p_writer or v_old_reviewer is distinct from p_reviewer then null else t.review_approved_at end,
        last_activity_at = pg_catalog.clock_timestamp()
    where t.id = p_topic;
  insert into public.events (topic_id, actor_id, kind, data)
    values (p_topic, auth.uid(), 'persone_assegnate',
      pg_catalog.jsonb_build_object('writer_id', p_writer, 'reviewer_id', p_reviewer));
end $$;
revoke all on function public.assign_people(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.assign_people(uuid,uuid,uuid) to authenticated;
