create function app.reevaluate_open_topics()
returns void language plpgsql security definer set search_path = ''
as $$ begin null; end $$;
revoke all on function app.reevaluate_open_topics() from public, anon, authenticated;

create unique index invites_one_open_per_email on public.invites (email)
  where used_at is null and revoked_at is null;

create function public.create_invite(p_email text, p_role text, p_token_hash text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_email text := pg_catalog.lower(pg_catalog.btrim(p_email));
  v_id uuid;
begin
  if not app.is_active_member() or app.my_role() not in ('decisore', 'manutentore') then
    raise exception using errcode = 'P0001', message = 'non_autorizzato';
  end if;
  if v_email is null or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     or pg_catalog.length(v_email) > 320 or p_role is null or p_role not in ('decisore', 'membro')
     or p_token_hash is null or p_token_hash !~ '^[0-9a-fA-F]{64}$'
     or exists (select 1 from public.profiles as p where pg_catalog.lower(p.email) = v_email) then
    raise exception using errcode = 'P0001', message = 'dati_non_validi';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_email, 0));
  with revoked as (
    update public.invites as i set revoked_at = pg_catalog.now()
      where i.email = v_email and i.used_at is null and i.revoked_at is null
      returning i.id
  )
  insert into public.events (topic_id, actor_id, kind, data)
    select null, auth.uid(), 'invito_revocato', pg_catalog.jsonb_build_object('invite_id', r.id)
    from revoked as r;
  insert into public.invites (email, role, token_hash, invited_by)
    values (v_email, p_role, pg_catalog.lower(p_token_hash), auth.uid()) returning id into v_id;
  insert into public.events (topic_id, actor_id, kind, data)
    values (null, auth.uid(), 'invito_creato', pg_catalog.jsonb_build_object('invite_id', v_id, 'role', p_role));
  return v_id;
end $$;
revoke all on function public.create_invite(text,text,text) from public, anon, authenticated;
grant execute on function public.create_invite(text,text,text) to authenticated;

create function public.revoke_invite(p_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_invite public.invites%rowtype;
begin
  if not app.is_active_member() then
    raise exception using errcode = 'P0001', message = 'non_autorizzato';
  end if;
  select * into v_invite from public.invites as i where i.id = p_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'invito_non_valido';
  end if;
  if v_invite.invited_by <> auth.uid() and app.my_role() <> 'manutentore' then
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

create function public.peek_invite(p_token_hash text, p_email text)
returns text language plpgsql security definer set search_path = ''
as $$
declare v_invite public.invites%rowtype;
begin
  select * into v_invite from public.invites as i where i.token_hash = pg_catalog.lower(p_token_hash);
  if not found or v_invite.revoked_at is not null then
    raise exception using errcode = 'P0001', message = 'invito_non_valido';
  end if;
  if v_invite.used_at is not null then
    raise exception using errcode = 'P0001', message = 'invito_usato';
  end if;
  if v_invite.expires_at <= pg_catalog.clock_timestamp() then
    raise exception using errcode = 'P0001', message = 'invito_scaduto';
  end if;
  if p_email is not null and v_invite.email <> pg_catalog.lower(pg_catalog.btrim(p_email)) then
    raise exception using errcode = 'P0001', message = 'email_diversa';
  end if;
  return v_invite.email;
end $$;
revoke all on function public.peek_invite(text,text) from public, anon, authenticated;
grant execute on function public.peek_invite(text,text) to service_role;

create function public.redeem_invite(p_token_hash text, p_user uuid, p_email text, p_display_name text)
returns text language plpgsql security definer set search_path = ''
as $$
declare v_invite public.invites%rowtype;
declare v_name text := pg_catalog.btrim(p_display_name);
begin
  select * into v_invite from public.invites as i where i.token_hash = pg_catalog.lower(p_token_hash) for update;
  if not found or v_invite.revoked_at is not null then
    raise exception using errcode = 'P0001', message = 'invito_non_valido';
  end if;
  if v_invite.used_at is not null then
    raise exception using errcode = 'P0001', message = 'invito_usato';
  end if;
  if v_invite.expires_at <= pg_catalog.clock_timestamp() then
    raise exception using errcode = 'P0001', message = 'invito_scaduto';
  end if;
  if p_email is null or v_invite.email <> pg_catalog.lower(pg_catalog.btrim(p_email)) then
    raise exception using errcode = 'P0001', message = 'email_diversa';
  end if;
  if p_user is null or v_name is null or pg_catalog.length(v_name) not between 1 and 100
     or not exists (select 1 from auth.users as u where u.id = p_user and pg_catalog.lower(u.email) = v_invite.email)
     or exists (select 1 from public.profiles as p where p.id = p_user or pg_catalog.lower(p.email) = v_invite.email) then
    raise exception using errcode = 'P0001', message = 'dati_non_validi';
  end if;
  insert into public.profiles (id, display_name, email, role)
    values (p_user, v_name, v_invite.email, v_invite.role);
  update public.invites as i set used_at = pg_catalog.now() where i.id = v_invite.id;
  insert into public.events (topic_id, actor_id, kind, data)
    values (null, auth.uid(), 'invito_usato', pg_catalog.jsonb_build_object('invite_id', v_invite.id, 'user_id', p_user));
  return v_invite.role;
end $$;
revoke all on function public.redeem_invite(text,uuid,text,text) from public, anon, authenticated;
grant execute on function public.redeem_invite(text,uuid,text,text) to service_role;

create function public.set_role(p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_old text;
begin
  if not app.is_active_member() or app.my_role() <> 'manutentore' then
    raise exception using errcode = 'P0001', message = 'non_autorizzato';
  end if;
  if p_role not in ('decisore', 'membro') or p_role is null or p_user = auth.uid() then
    raise exception using errcode = 'P0001', message = 'dati_non_validi';
  end if;
  select p.role into v_old from public.profiles as p where p.id = p_user for update;
  if not found or v_old = 'manutentore' then
    raise exception using errcode = 'P0001', message = 'dati_non_validi';
  end if;
  update public.profiles as p set role = p_role where p.id = p_user;
  insert into public.events (topic_id, actor_id, kind, data)
    values (null, auth.uid(), 'ruolo_cambiato', pg_catalog.jsonb_build_object('user_id', p_user, 'from', v_old, 'to', p_role));
  perform app.reevaluate_open_topics();
end $$;
revoke all on function public.set_role(uuid,text) from public, anon, authenticated;
grant execute on function public.set_role(uuid,text) to authenticated;

create function public.set_active(p_user uuid, p_active boolean)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_old boolean;
declare v_role text;
begin
  if not app.is_active_member() or app.my_role() <> 'manutentore' then
    raise exception using errcode = 'P0001', message = 'non_autorizzato';
  end if;
  if p_active is null or p_user = auth.uid() then
    raise exception using errcode = 'P0001', message = 'dati_non_validi';
  end if;
  select p.active, p.role into v_old, v_role from public.profiles as p where p.id = p_user for update;
  if not found or v_role = 'manutentore' then
    raise exception using errcode = 'P0001', message = 'dati_non_validi';
  end if;
  update public.profiles as p set active = p_active where p.id = p_user;
  insert into public.events (topic_id, actor_id, kind, data)
    values (null, auth.uid(), 'attivo_cambiato', pg_catalog.jsonb_build_object('user_id', p_user, 'from', v_old, 'to', p_active));
  perform app.reevaluate_open_topics();
end $$;
revoke all on function public.set_active(uuid,boolean) from public, anon, authenticated;
grant execute on function public.set_active(uuid,boolean) to authenticated;

create function public.set_decision_rule(p_rule text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_old text;
begin
  if not app.is_active_member() or app.my_role() <> 'manutentore' then
    raise exception using errcode = 'P0001', message = 'non_autorizzato';
  end if;
  if p_rule is null or p_rule not in ('unanimita', 'maggioranza') then
    raise exception using errcode = 'P0001', message = 'dati_non_validi';
  end if;
  select s.decision_rule into v_old from public.settings as s where s.id = 1 for update;
  update public.settings as s set decision_rule = p_rule where s.id = 1;
  insert into public.events (topic_id, actor_id, kind, data)
    values (null, auth.uid(), 'regola_cambiata', pg_catalog.jsonb_build_object('from', v_old, 'to', p_rule));
  perform app.reevaluate_open_topics();
end $$;
revoke all on function public.set_decision_rule(text) from public, anon, authenticated;
grant execute on function public.set_decision_rule(text) to authenticated;

create function public.set_stale_days(p_days integer)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_old integer;
begin
  if not app.is_active_member() or app.my_role() <> 'manutentore' then
    raise exception using errcode = 'P0001', message = 'non_autorizzato';
  end if;
  if p_days is null or p_days < 1 then
    raise exception using errcode = 'P0001', message = 'dati_non_validi';
  end if;
  select s.stale_days into v_old from public.settings as s where s.id = 1 for update;
  update public.settings as s set stale_days = p_days where s.id = 1;
  insert into public.events (topic_id, actor_id, kind, data)
    values (null, auth.uid(), 'giorni_cambiati', pg_catalog.jsonb_build_object('from', v_old, 'to', p_days));
end $$;
revoke all on function public.set_stale_days(integer) from public, anon, authenticated;
grant execute on function public.set_stale_days(integer) to authenticated;
