create function public.set_link_title(p_topic uuid, p_title text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_title text := app.clean_text(p_title);
begin
  if not app.is_active_member()
     or not exists (
       select 1 from public.topics as t
       where t.id = p_topic and t.proposed_by = auth.uid()
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
    where t.id = p_topic and t.proposed_by = auth.uid() and t.link_title is null;
end $$;
revoke all on function public.set_link_title(uuid,text) from public, anon, authenticated;
grant execute on function public.set_link_title(uuid,text) to authenticated;
