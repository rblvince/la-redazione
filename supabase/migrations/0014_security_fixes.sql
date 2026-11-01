-- Lock order: settings, profiles by UUID, topics by UUID.
-- These functions do not lock settings; caller profile is locked before a topic.

create or replace function app.gate_missing(p_topic uuid)
returns text[] language sql stable security definer set search_path = ''
as $$
  select pg_catalog.array_agg(m.item order by m.position)
  from (
    select required.position, required.item
    from (values
      (1, 'verifica', 'isolare'), (2, 'verifica', 'fonte_primaria'),
      (3, 'verifica', 'lettura_intera'), (4, 'verifica', 'secondo_riscontro'),
      (5, 'verifica', 'controllo_legale'), (6, 'legale', 'diffamazione'),
      (7, 'legale', 'continenza'), (8, 'legale', 'gdpr_minori'),
      (9, 'legale', 'copyright'), (10, 'legale', 'rettifica')
    ) as required(position, kind, item)
    where not exists (
      select 1 from public.checks as c
      where c.topic_id = p_topic and c.kind = required.kind and c.item = required.item
    )
    union all
    select 11, 'fonti' where exists (
      select 1 from public.topics as t where t.id = p_topic
      and not exists (select 1 from public.sources as s where s.topic_id = t.id)
    )
    union all
    select 12, 'scrittore' where exists (
      select 1 from public.topics as t where t.id = p_topic
      and not exists (
        select 1 from public.profiles as p where p.id = t.writer_id and p.active
      )
    )
    union all
    select 13, 'rilettore' where exists (
      select 1 from public.topics as t where t.id = p_topic
      and not exists (
        select 1 from public.profiles as p where p.id = t.reviewer_id and p.active
      )
    )
    union all
    select 14, 'rilettura' where exists (
      select 1 from public.topics as t where t.id = p_topic
      and (t.review_approved_at is null or t.review_approved_by is distinct from t.reviewer_id
        or not exists (
          select 1 from public.profiles as p where p.id = t.reviewer_id and p.active
        ))
    )
  ) as m
$$;
revoke all on function app.gate_missing(uuid) from public, anon, authenticated;

create or replace function public.toggle_check(p_topic uuid, p_kind text, p_item text, p_done boolean)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_stage text;
declare v_role text;
begin
  select p.role into v_role from public.profiles as p
    where p.id = auth.uid() and p.active for share;
  if not found or v_role not in ('decisore', 'membro') then
    raise exception using errcode = 'P0001', message = 'non_autorizzato';
  end if;
  if p_topic is null or p_kind is null or p_item is null or p_done is null or not (
    (p_kind = 'verifica' and p_item in ('isolare', 'fonte_primaria', 'lettura_intera', 'secondo_riscontro', 'controllo_legale'))
    or (p_kind = 'legale' and p_item in ('diffamazione', 'continenza', 'gdpr_minori', 'copyright', 'rettifica'))
  ) then
    raise exception using errcode = 'P0001', message = 'dati_non_validi';
  end if;
  select t.stage into v_stage from public.topics as t where t.id = p_topic for update;
  if not found then raise exception using errcode = 'P0001', message = 'dati_non_validi'; end if;
  if v_stage not in ('verifica', 'legale') then
    raise exception using errcode = 'P0001', message = 'fase_sbagliata';
  end if;
  if p_kind = 'legale' and v_stage <> 'legale' then
    raise exception using errcode = 'P0001', message = 'fase_sbagliata';
  end if;
  if p_done then
    insert into public.checks (topic_id, kind, item, done_by)
      values (p_topic, p_kind, p_item, auth.uid())
      on conflict (topic_id, kind, item) do update
      set done_by = excluded.done_by, done_at = pg_catalog.clock_timestamp();
  else
    delete from public.checks as c
      where c.topic_id = p_topic and c.kind = p_kind and c.item = p_item;
  end if;
  update public.topics as t set
    stage = case when (select pg_catalog.count(*) from public.checks as c
      where c.topic_id = p_topic and c.kind = 'verifica') = 5 then 'legale' else 'verifica' end,
    review_approved_by = null,
    review_approved_at = null,
    last_activity_at = pg_catalog.clock_timestamp()
    where t.id = p_topic;
  insert into public.events (topic_id, actor_id, kind, data)
    values (p_topic, auth.uid(), case when p_done then 'spunta' else 'spunta_tolta' end,
      pg_catalog.jsonb_build_object('kind', p_kind, 'item', p_item));
end $$;
revoke all on function public.toggle_check(uuid,text,text,boolean) from public, anon, authenticated;
grant execute on function public.toggle_check(uuid,text,text,boolean) to authenticated;

create or replace function public.add_source(
  p_topic uuid, p_title text, p_url text, p_kind text, p_screenshot_path text
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_role text;
declare v_stage text;
declare v_id uuid;
begin
  select p.role into v_role from public.profiles as p
    where p.id = auth.uid() and p.active for share;
  if not found or v_role not in ('decisore', 'membro') then
    raise exception using errcode = 'P0001', message = 'non_autorizzato';
  end if;
  if p_topic is null or not app.valid_gate_text(p_title, 280)
     or not app.valid_gate_url(p_url) or p_kind is null or p_kind not in ('primaria', 'secondaria')
     or (p_screenshot_path is not null and p_screenshot_path !~
       ('^' || p_topic::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|jpeg|webp)$')) then
    raise exception using errcode = 'P0001', message = 'dati_non_validi';
  end if;
  select t.stage into v_stage from public.topics as t where t.id = p_topic for update;
  if not found then raise exception using errcode = 'P0001', message = 'dati_non_validi'; end if;
  if v_stage not in ('verifica', 'legale') then
    raise exception using errcode = 'P0001', message = 'fase_sbagliata';
  end if;
  insert into public.sources (topic_id, title, url, kind, screenshot_path, added_by)
    values (p_topic, app.clean_text(p_title), p_url, p_kind, p_screenshot_path, auth.uid())
    returning id into v_id;
  update public.topics as t set review_approved_by = null, review_approved_at = null,
    last_activity_at = pg_catalog.clock_timestamp() where t.id = p_topic;
  insert into public.events (topic_id, actor_id, kind, data)
    values (p_topic, auth.uid(), 'fonte_aggiunta', pg_catalog.jsonb_build_object('source_id', v_id));
  return v_id;
end $$;
revoke all on function public.add_source(uuid,text,text,text,text) from public, anon, authenticated;
grant execute on function public.add_source(uuid,text,text,text,text) to authenticated;

create or replace function public.delete_source(p_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_role text;
declare v_topic uuid;
declare v_stage text;
declare v_author uuid;
begin
  select p.role into v_role from public.profiles as p
    where p.id = auth.uid() and p.active for share;
  if not found or v_role not in ('decisore', 'membro') then
    raise exception using errcode = 'P0001', message = 'non_autorizzato';
  end if;
  if p_id is null then raise exception using errcode = 'P0001', message = 'dati_non_validi'; end if;
  select s.topic_id into v_topic from public.sources as s where s.id = p_id;
  if not found then raise exception using errcode = 'P0001', message = 'dati_non_validi'; end if;
  select t.stage into v_stage from public.topics as t where t.id = v_topic for update;
  select s.added_by into v_author from public.sources as s where s.id = p_id and s.topic_id = v_topic;
  if not found then raise exception using errcode = 'P0001', message = 'dati_non_validi'; end if;
  if v_author <> auth.uid() then
    raise exception using errcode = 'P0001', message = 'non_autorizzato';
  end if;
  if v_stage = 'pubblicato' then
    raise exception using errcode = 'P0001', message = 'fase_sbagliata';
  end if;
  delete from public.sources as s where s.id = p_id;
  update public.topics as t set review_approved_by = null, review_approved_at = null,
    last_activity_at = pg_catalog.clock_timestamp() where t.id = v_topic;
  insert into public.events (topic_id, actor_id, kind, data)
    values (v_topic, auth.uid(), 'fonte_eliminata', pg_catalog.jsonb_build_object('source_id', p_id));
end $$;
revoke all on function public.delete_source(uuid) from public, anon, authenticated;
grant execute on function public.delete_source(uuid) to authenticated;

create or replace function public.approve_review(p_topic uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_role text;
declare v_stage text;
declare v_reviewer uuid;
begin
  select p.role into v_role from public.profiles as p
    where p.id = auth.uid() and p.active for share;
  if not found or v_role not in ('decisore', 'membro') then
    raise exception using errcode = 'P0001', message = 'non_autorizzato';
  end if;
  if p_topic is null then raise exception using errcode = 'P0001', message = 'dati_non_validi'; end if;
  select t.stage, t.reviewer_id into v_stage, v_reviewer
    from public.topics as t where t.id = p_topic for update;
  if not found then raise exception using errcode = 'P0001', message = 'dati_non_validi'; end if;
  if v_reviewer is distinct from auth.uid() then
    raise exception using errcode = 'P0001', message = 'non_autorizzato';
  end if;
  if v_stage <> 'legale' then
    raise exception using errcode = 'P0001', message = 'fase_sbagliata';
  end if;
  if exists (
    select 1 from pg_catalog.unnest(coalesce(app.gate_missing(p_topic), array[]::text[])) as missing(item)
    where missing.item <> 'rilettura'
  ) then
    raise exception using errcode = 'P0001', message = 'cancello_chiuso';
  end if;
  update public.topics as t set review_approved_by = auth.uid(),
    review_approved_at = pg_catalog.clock_timestamp(), last_activity_at = pg_catalog.clock_timestamp()
    where t.id = p_topic;
  insert into public.events (topic_id, actor_id, kind)
    values (p_topic, auth.uid(), 'rilettura_approvata');
end $$;
revoke all on function public.approve_review(uuid) from public, anon, authenticated;
grant execute on function public.approve_review(uuid) to authenticated;

create or replace function public.revoke_invite(p_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_invite public.invites%rowtype;
declare v_role text;
begin
  select p.role into v_role from public.profiles as p
    where p.id = auth.uid() and p.active for share;
  if not found or v_role not in ('decisore', 'manutentore') then
    raise exception using errcode = 'P0001', message = 'non_autorizzato';
  end if;
  select * into v_invite from public.invites as i where i.id = p_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'invito_non_valido';
  end if;
  if v_invite.invited_by <> auth.uid() and v_role <> 'manutentore' then
    raise exception using errcode = 'P0001', message = 'non_autorizzato';
  end if;
  if v_invite.used_at is not null or v_invite.revoked_at is not null then
    raise exception using errcode = 'P0001', message = 'invito_non_valido';
  end if;
  update public.invites as i set revoked_at = pg_catalog.now() where i.id = p_id;
  insert into public.events (topic_id, actor_id, kind, data)
    values (null, auth.uid(), 'invito_revocato', pg_catalog.jsonb_build_object('invite_id', p_id));
end $$;
revoke all on function public.revoke_invite(uuid) from public, anon, authenticated;
grant execute on function public.revoke_invite(uuid) to authenticated;
