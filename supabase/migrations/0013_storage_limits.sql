-- Storage quota and policy use storage.objects, which is supplied by Supabase.
-- SECURITY DEFINER prevents recursive RLS while counting storage.objects in its INSERT policy.
create function app.can_upload_source_screenshot(p_owner text, p_name text)
returns boolean language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_topic text := pg_catalog.split_part(p_name, '/', 1);
  v_count integer;
begin
  if p_owner is distinct from auth.uid()::text then return false; end if;
  -- Serialize simultaneous uploads for each owner and topic before counting.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(p_owner), pg_catalog.hashtext(v_topic)
  );
  select pg_catalog.count(*)::integer into v_count
    from storage.objects as o
    where o.bucket_id = 'fonti' and o.owner_id = p_owner
      and pg_catalog.split_part(o.name, '/', 1) = v_topic;
  return v_count < 20;
end $$;
revoke all on function app.can_upload_source_screenshot(text,text) from public, anon, authenticated;
grant execute on function app.can_upload_source_screenshot(text,text) to authenticated;

-- The Storage schema is provided by Supabase and deliberately omitted in PGlite.
do $$
begin
  if pg_catalog.to_regclass('storage.objects') is not null then
    execute 'drop policy fonti_insert on storage.objects';
    execute $policy$
      create policy fonti_insert on storage.objects for insert to authenticated
      with check (
        bucket_id = 'fonti' and (select app.is_active_member())
        and (select app.my_role()) in ('decisore', 'membro')
        and owner_id = (select auth.uid())::text
        and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|jpeg|webp)$'
        and exists (
          select 1 from public.topics as t
          where t.id::text = split_part(name, '/', 1)
            and t.stage in ('verifica', 'legale')
        )
        and app.can_upload_source_screenshot(owner_id, name)
      )
    $policy$;
  end if;
end $$;

-- Drop the browser-callable overload before creating the privileged RPC.
drop function public.set_link_title(uuid,text);
create function public.set_link_title(p_topic uuid, p_actor uuid, p_title text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_title text := app.clean_text(p_title);
begin
  if not exists (
       select 1 from public.topics as t
       where t.id = p_topic and t.proposed_by = p_actor
     ) then
    raise exception using errcode = 'P0001', message = 'non_autorizzato';
  end if;
  if v_title is null or pg_catalog.char_length(v_title) < 1
     or p_title ~ E'[\u202A-\u202E\u2066-\u2069]'
     or pg_catalog.regexp_replace(
       v_title,
       E'[\u00AD\u0300-\u036F\u061C\u115F-\u1160\u17B4-\u17B5\u180B-\u180F\u1AB0-\u1AFF\u1DC0-\u1DFF\u200B-\u200F\u202A-\u202E\u2060-\u206F\u20D0-\u20FF\u2800\u3164\uFE00-\uFE0F\uFE20-\uFE2F\uFEFF\uFFA0\uFFF0-\uFFF8\U0001BCA0-\U0001BCA3\U0001D173-\U0001D17A\U000E0000-\U000E0FFF]',
       '', 'g'
     ) !~ '[[:alnum:][:punct:]]' then
    raise exception using errcode = 'P0001', message = 'dati_non_validi';
  end if;
  update public.topics as t
    set link_title = pg_catalog.left(v_title, 200)
    where t.id = p_topic and t.proposed_by = p_actor and t.link_title is null;
end $$;
revoke all on function public.set_link_title(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.set_link_title(uuid,uuid,text) to service_role;

-- Preserve all other validation from 0007. p_link_title is intentionally ignored.
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
     or pg_catalog.regexp_replace(
       v_title,
       E'[\u00AD\u0300-\u036F\u061C\u115F-\u1160\u17B4-\u17B5\u180B-\u180F\u1AB0-\u1AFF\u1DC0-\u1DFF\u200B-\u200F\u202A-\u202E\u2060-\u206F\u20D0-\u20FF\u2800\u3164\uFE00-\uFE0F\uFE20-\uFE2F\uFEFF\uFFA0\uFFF0-\uFFF8\U0001BCA0-\U0001BCA3\U0001D173-\U0001D17A\U000E0000-\U000E0FFF]',
       '', 'g'
     ) !~ '[[:alnum:][:punct:]]'
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
    values (v_title, p_body, p_link, null,
      v_site, p_format, auth.uid())
    returning id into v_id;
  insert into public.events (topic_id, actor_id, kind, data)
    values (v_id, auth.uid(), 'proposto', pg_catalog.jsonb_build_object('format', p_format));
  return v_id;
end $$;
revoke all on function public.propose_topic(text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.propose_topic(text,text,text,text,text) to authenticated;
