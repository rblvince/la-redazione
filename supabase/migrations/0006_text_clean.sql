create or replace function app.clean_text(p_text text)
returns text language sql immutable set search_path = ''
as $$
  select pg_catalog.regexp_replace(
    p_text,
    E'^[[:space:]\u00A0\u1680\u2000-\u200D\u2028\u2029\u202F\u205F\u2060\u2800\u3000\u3164\uFEFF]+|[[:space:]\u00A0\u1680\u2000-\u200D\u2028\u2029\u202F\u205F\u2060\u2800\u3000\u3164\uFEFF]+$',
    '', 'g'
  )
$$;
revoke all on function app.clean_text(text) from public, anon, authenticated;

create or replace function public.claim_preview()
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  perform 1 from public.profiles as p
    where p.id = v_user and p.active and p.role in ('decisore', 'membro')
    for no key update;
  if not found then
    raise exception using errcode = 'P0001', message = 'non_autorizzato';
  end if;
  if (select pg_catalog.count(*) from app.preview_requests as r
      where r.user_id = v_user and r.at > pg_catalog.now() - interval '10 minutes') >= 20 then
    raise exception using errcode = 'P0001', message = 'troppe_richieste';
  end if;
  insert into app.preview_requests (user_id) values (v_user);
  delete from app.preview_requests as r
    where r.user_id = v_user and r.at < pg_catalog.now() - interval '1 day';
end $$;
revoke all on function public.claim_preview() from public, anon, authenticated;
grant execute on function public.claim_preview() to authenticated;

create or replace function public.propose_topic(
  p_title text, p_body text, p_link text, p_link_title text, p_format text
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_title text := app.clean_text(p_title);
  v_host text := pg_catalog.substring(p_link, '^https://([^/?#]+)');
  v_host_clean text := pg_catalog.rtrim(v_host, '.');
  v_site text;
  v_id uuid;
begin
  if not app.is_active_member() or app.my_role() not in ('decisore', 'membro') then
    raise exception using errcode = 'P0001', message = 'non_autorizzato';
  end if;
  if v_title is null or pg_catalog.char_length(v_title) not between 1 and 280
     or p_title ~ E'[\u202A-\u202E\u2066-\u2069]'
     or (p_body is not null and pg_catalog.char_length(p_body) > 4000)
     or (p_link is not null and (
       pg_catalog.char_length(p_link) > 2048
       or p_link !~ '^https://[a-z0-9.-]+([/?#][^[:space:]]*)?$'
       or v_host_clean !~ '\.'
       or v_host_clean = 'localhost'
       or v_host_clean ~ '\.(local|internal|localhost)$'
       or v_host_clean ~ '^[0-9]+(\.[0-9]+){3}$'
       or v_host_clean ~ '\.(0x[0-9a-f]*|[0-9]+)$'
     ))
     or (p_format is not null and p_format not in
       ('fonte_alla_mano', 'a_caldo', 'non_ti_hanno_detto', 'fuorigioco')) then
    raise exception using errcode = 'P0001', message = 'dati_non_validi';
  end if;
  v_site := pg_catalog.regexp_replace(v_host_clean, '^www\.', '');
  insert into public.topics (title, body, link_url, link_title, link_site, format, proposed_by)
    values (v_title, p_body, p_link, pg_catalog.left(p_link_title, 200),
      v_site, p_format, auth.uid())
    returning id into v_id;
  insert into public.events (topic_id, actor_id, kind, data)
    values (v_id, auth.uid(), 'proposto', pg_catalog.jsonb_build_object('format', p_format));
  return v_id;
end $$;
revoke all on function public.propose_topic(text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.propose_topic(text,text,text,text,text) to authenticated;

create or replace function public.add_comment(p_topic uuid, p_body text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_body text := app.clean_text(p_body);
  v_id uuid;
begin
  if not app.is_active_member() or app.my_role() not in ('decisore', 'membro') then
    raise exception using errcode = 'P0001', message = 'non_autorizzato';
  end if;
  if v_body is null or pg_catalog.char_length(v_body) not between 1 and 4000
     or p_body ~ E'[\u202A-\u202E\u2066-\u2069]'
     or p_topic is null or not exists (select 1 from public.topics as t where t.id = p_topic) then
    raise exception using errcode = 'P0001', message = 'dati_non_validi';
  end if;
  insert into public.comments (topic_id, author_id, body)
    values (p_topic, auth.uid(), v_body) returning id into v_id;
  update public.topics as t set last_activity_at = pg_catalog.now() where t.id = p_topic;
  insert into public.events (topic_id, actor_id, kind, data)
    values (p_topic, auth.uid(), 'commento', '{}'::jsonb);
  return v_id;
end $$;
revoke all on function public.add_comment(uuid,text) from public, anon, authenticated;
grant execute on function public.add_comment(uuid,text) to authenticated;
