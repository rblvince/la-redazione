-- Storage objects are supplied by Supabase and are not available in the PGlite harness.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fonti', 'fonti', false, 5242880, array['image/png', 'image/jpeg', 'image/webp']);

create policy fonti_read on storage.objects for select to authenticated
  using (bucket_id = 'fonti' and (select app.is_active_member()));

create policy fonti_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'fonti' and (select app.is_active_member())
    and owner_id = (select auth.uid())::text
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|jpeg|webp)$'
    and exists (
      select 1 from public.topics as t
      where t.id::text = split_part(name, '/', 1)
        and t.stage in ('verifica', 'legale')
    )
  );

create policy fonti_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'fonti' and (select app.is_active_member())
    and owner_id = (select auth.uid())::text
    and exists (
      select 1 from public.topics as t
      where t.id::text = split_part(name, '/', 1) and t.stage <> 'pubblicato'
    )
    and not exists (
      select 1 from public.sources as s where s.screenshot_path = name
    )
  );
