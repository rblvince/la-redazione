create function public.propose_topic(
  p_title text, p_body text, p_link text, p_link_title text, p_link_site text, p_format text
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_title text := pg_catalog.btrim(p_title);
  v_id uuid;
begin
  if not app.is_active_member() or app.my_role() not in ('decisore', 'membro') then
    raise exception using errcode = 'P0001', message = 'non_autorizzato';
  end if;
  if v_title is null or pg_catalog.char_length(v_title) not between 1 and 280
     or (p_body is not null and pg_catalog.char_length(p_body) > 4000)
     or (p_link is not null and (
       pg_catalog.char_length(p_link) > 2048
       or p_link !~ '^https://[a-z0-9.-]+([/?#][^[:space:]]*)?$'
     ))
     or (p_format is not null and p_format not in
       ('fonte_alla_mano', 'a_caldo', 'non_ti_hanno_detto', 'fuorigioco')) then
    raise exception using errcode = 'P0001', message = 'dati_non_validi';
  end if;
  insert into public.topics (title, body, link_url, link_title, link_site, format, proposed_by)
    values (v_title, p_body, p_link, pg_catalog.left(p_link_title, 200),
      pg_catalog.left(p_link_site, 200), p_format, auth.uid())
    returning id into v_id;
  insert into public.events (topic_id, actor_id, kind, data)
    values (v_id, auth.uid(), 'proposto', pg_catalog.jsonb_build_object('format', p_format));
  return v_id;
end $$;
revoke all on function public.propose_topic(text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.propose_topic(text,text,text,text,text,text) to authenticated;

create function public.add_comment(p_topic uuid, p_body text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_body text := pg_catalog.btrim(p_body);
  v_id uuid;
begin
  if not app.is_active_member() or app.my_role() not in ('decisore', 'membro') then
    raise exception using errcode = 'P0001', message = 'non_autorizzato';
  end if;
  if v_body is null or pg_catalog.char_length(v_body) not between 1 and 4000
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
