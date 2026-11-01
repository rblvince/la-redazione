-- Lock order for gate RPCs: settings, profiles by UUID, topics by UUID.
-- These RPCs do not need settings; each locks the caller profile before the topic.
create function app.valid_gate_url(p_url text)
returns boolean language sql immutable set search_path = ''
as $$
  select p_url is not null and pg_catalog.char_length(p_url) <= 2048
    and p_url ~ '^https://[a-z0-9.-]+([/?#][^[:space:]]*)?$'
    and pg_catalog.rtrim(pg_catalog.substring(p_url, '^https://([^/?#]+)'), '.') ~ '\.'
    and pg_catalog.rtrim(pg_catalog.substring(p_url, '^https://([^/?#]+)'), '.') <> 'localhost'
    and pg_catalog.rtrim(pg_catalog.substring(p_url, '^https://([^/?#]+)'), '.') !~ '\.(local|internal|localhost)$'
    and pg_catalog.rtrim(pg_catalog.substring(p_url, '^https://([^/?#]+)'), '.') !~ '^[0-9]+(\.[0-9]+){3}$'
    and pg_catalog.rtrim(pg_catalog.substring(p_url, '^https://([^/?#]+)'), '.') !~ '\.(0x[0-9a-f]*|[0-9]+)$'
$$;
revoke all on function app.valid_gate_url(text) from public, anon, authenticated;

create function app.valid_gate_text(p_text text, p_max integer)
returns boolean language sql immutable set search_path = ''
as $$
  select p_text is not null
    and pg_catalog.char_length(app.clean_text(p_text)) between 1 and p_max
    and p_text !~ E'[\u202A-\u202E\u2066-\u2069]'
    and pg_catalog.regexp_replace(
      app.clean_text(p_text),
      E'[\u00AD\u0300-\u036F\u061C\u115F-\u1160\u17B4-\u17B5\u180B-\u180F\u1AB0-\u1AFF\u1DC0-\u1DFF\u200B-\u200F\u202A-\u202E\u2060-\u206F\u20D0-\u20FF\u2800\u3164\uFE00-\uFE0F\uFE20-\uFE2F\uFEFF\uFFA0\uFFF0-\uFFF8\U0001BCA0-\U0001BCA3\U0001D173-\U0001D17A\U000E0000-\U000E0FFF]',
      '', 'g'
    ) ~ '[[:alnum:][:punct:]]'
$$;
revoke all on function app.valid_gate_text(text,integer) from public, anon, authenticated;

create function app.gate_missing(p_topic uuid)
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
    select 11, 'scrittore' where exists (
      select 1 from public.topics as t where t.id = p_topic
      and not exists (
        select 1 from public.profiles as p where p.id = t.writer_id and p.active
      )
    )
    union all
    select 12, 'rilettore' where exists (
      select 1 from public.topics as t where t.id = p_topic
      and not exists (
        select 1 from public.profiles as p where p.id = t.reviewer_id and p.active
      )
    )
    union all
    select 13, 'rilettura' where exists (
      select 1 from public.topics as t where t.id = p_topic
      and (t.review_approved_at is null or t.review_approved_by is distinct from t.reviewer_id
        or not exists (
          select 1 from public.profiles as p where p.id = t.reviewer_id and p.active
        ))
    )
  ) as m
$$;
revoke all on function app.gate_missing(uuid) from public, anon, authenticated;

create function public.toggle_check(p_topic uuid, p_kind text, p_item text, p_done boolean)
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
    review_approved_by = case when p_done then t.review_approved_by else null end,
    review_approved_at = case when p_done then t.review_approved_at else null end,
    last_activity_at = pg_catalog.clock_timestamp()
    where t.id = p_topic;
  insert into public.events (topic_id, actor_id, kind, data)
    values (p_topic, auth.uid(), case when p_done then 'spunta' else 'spunta_tolta' end,
      pg_catalog.jsonb_build_object('kind', p_kind, 'item', p_item));
end $$;
revoke all on function public.toggle_check(uuid,text,text,boolean) from public, anon, authenticated;
grant execute on function public.toggle_check(uuid,text,text,boolean) to authenticated;

create function public.add_source(
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
  update public.topics as t set last_activity_at = pg_catalog.clock_timestamp() where t.id = p_topic;
  insert into public.events (topic_id, actor_id, kind, data)
    values (p_topic, auth.uid(), 'fonte_aggiunta', pg_catalog.jsonb_build_object('source_id', v_id));
  return v_id;
end $$;
revoke all on function public.add_source(uuid,text,text,text,text) from public, anon, authenticated;
grant execute on function public.add_source(uuid,text,text,text,text) to authenticated;

create function public.delete_source(p_id uuid)
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
  update public.topics as t set last_activity_at = pg_catalog.clock_timestamp() where t.id = v_topic;
  insert into public.events (topic_id, actor_id, kind, data)
    values (v_topic, auth.uid(), 'fonte_eliminata', pg_catalog.jsonb_build_object('source_id', p_id));
end $$;
revoke all on function public.delete_source(uuid) from public, anon, authenticated;
grant execute on function public.delete_source(uuid) to authenticated;

create function public.approve_review(p_topic uuid)
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
  update public.topics as t set review_approved_by = auth.uid(),
    review_approved_at = pg_catalog.clock_timestamp(), last_activity_at = pg_catalog.clock_timestamp()
    where t.id = p_topic;
  insert into public.events (topic_id, actor_id, kind)
    values (p_topic, auth.uid(), 'rilettura_approvata');
end $$;
revoke all on function public.approve_review(uuid) from public, anon, authenticated;
grant execute on function public.approve_review(uuid) to authenticated;

create function public.gate_status(p_topic uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_role text;
declare v_missing text[];
begin
  select p.role into v_role from public.profiles as p
    where p.id = auth.uid() and p.active for share;
  if not found or v_role not in ('decisore', 'membro') then
    raise exception using errcode = 'P0001', message = 'non_autorizzato';
  end if;
  if p_topic is null then raise exception using errcode = 'P0001', message = 'dati_non_validi'; end if;
  perform 1 from public.topics as t where t.id = p_topic for update;
  if not found then raise exception using errcode = 'P0001', message = 'dati_non_validi'; end if;
  v_missing := coalesce(app.gate_missing(p_topic), array[]::text[]);
  return pg_catalog.jsonb_build_object('ok', pg_catalog.cardinality(v_missing) = 0, 'missing', v_missing);
end $$;
revoke all on function public.gate_status(uuid) from public, anon, authenticated;
grant execute on function public.gate_status(uuid) to authenticated;

create function public.publish_topic(p_topic uuid, p_post_url text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_role text;
declare v_topic public.topics%rowtype;
declare v_writer uuid;
declare v_reviewer uuid;
declare v_profile record;
begin
  select p.role into v_role from public.profiles as p
    where p.id = auth.uid() and p.active;
  if not found or v_role not in ('decisore', 'membro') then
    raise exception using errcode = 'P0001', message = 'non_autorizzato';
  end if;
  if p_topic is null or not app.valid_gate_url(p_post_url) then
    raise exception using errcode = 'P0001', message = 'dati_non_validi';
  end if;
  select t.writer_id, t.reviewer_id into v_writer, v_reviewer
    from public.topics as t where t.id = p_topic;
  if not found then raise exception using errcode = 'P0001', message = 'dati_non_validi'; end if;
  v_role := null;
  for v_profile in
    select p.id, p.active, p.role from public.profiles as p
      where p.id in (auth.uid(), v_writer, v_reviewer)
      order by p.id for share
  loop
    if v_profile.id = auth.uid() and v_profile.active then
      v_role := v_profile.role;
    end if;
  end loop;
  if v_role not in ('decisore', 'membro') or v_role is null then
    raise exception using errcode = 'P0001', message = 'non_autorizzato';
  end if;
  select * into v_topic from public.topics as t where t.id = p_topic for update;
  if not found then raise exception using errcode = 'P0001', message = 'dati_non_validi'; end if;
  if auth.uid() is distinct from v_topic.writer_id and auth.uid() is distinct from v_topic.reviewer_id then
    raise exception using errcode = 'P0001', message = 'non_autorizzato';
  end if;
  if v_topic.writer_id is distinct from v_writer or v_topic.reviewer_id is distinct from v_reviewer then
    raise exception using errcode = 'P0001', message = 'cancello_chiuso';
  end if;
  if v_topic.stage = 'pubblicato' then
    if v_topic.post_url = p_post_url then return; end if;
    raise exception using errcode = 'P0001', message = 'fase_sbagliata';
  end if;
  if v_topic.stage <> 'legale' then
    raise exception using errcode = 'P0001', message = 'fase_sbagliata';
  end if;
  if pg_catalog.cardinality(coalesce(app.gate_missing(p_topic), array[]::text[])) <> 0 then
    raise exception using errcode = 'P0001', message = 'cancello_chiuso';
  end if;
  update public.topics as t set stage = 'pubblicato', post_url = p_post_url,
    published_at = pg_catalog.clock_timestamp(), last_activity_at = pg_catalog.clock_timestamp()
    where t.id = p_topic;
  insert into public.events (topic_id, actor_id, kind)
    values (p_topic, auth.uid(), 'pubblicato');
end $$;
revoke all on function public.publish_topic(uuid,text) from public, anon, authenticated;
grant execute on function public.publish_topic(uuid,text) to authenticated;

create function public.add_correction(
  p_topic uuid, p_body text, p_reason text, p_new_post_url text
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_role text;
declare v_stage text;
declare v_old_url text;
declare v_id uuid;
begin
  select p.role into v_role from public.profiles as p
    where p.id = auth.uid() and p.active for share;
  if not found or v_role not in ('decisore', 'membro') then
    raise exception using errcode = 'P0001', message = 'non_autorizzato';
  end if;
  if p_topic is null or not app.valid_gate_text(p_body, 4000)
     or not app.valid_gate_text(p_reason, 4000)
     or (p_new_post_url is not null and not app.valid_gate_url(p_new_post_url)) then
    raise exception using errcode = 'P0001', message = 'dati_non_validi';
  end if;
  select t.stage, t.post_url into v_stage, v_old_url
    from public.topics as t where t.id = p_topic for update;
  if not found then raise exception using errcode = 'P0001', message = 'dati_non_validi'; end if;
  if v_stage <> 'pubblicato' then
    raise exception using errcode = 'P0001', message = 'fase_sbagliata';
  end if;
  insert into public.corrections (topic_id, body, reason, new_post_url, author_id)
    values (p_topic, app.clean_text(p_body), app.clean_text(p_reason), p_new_post_url, auth.uid())
    returning id into v_id;
  update public.topics as t set post_url = coalesce(p_new_post_url, t.post_url),
    last_activity_at = pg_catalog.clock_timestamp() where t.id = p_topic;
  insert into public.events (topic_id, actor_id, kind, data)
    values (p_topic, auth.uid(), 'rettifica',
      pg_catalog.jsonb_build_object('correction_id', v_id) ||
      case when p_new_post_url is null then '{}'::jsonb
        else pg_catalog.jsonb_build_object('old_post_url', v_old_url) end);
  return v_id;
end $$;
revoke all on function public.add_correction(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.add_correction(uuid,text,text,text) to authenticated;

-- Existing grants already allow SELECT only. Keep writes exclusive to definer RPCs.
revoke insert, update, delete, truncate, references, trigger
  on public.checks, public.sources, public.corrections from public, anon, authenticated;
