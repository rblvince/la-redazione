create schema if not exists app;
revoke all on schema app from public, anon, authenticated;

-- PostgreSQL grants EXECUTE on new functions to PUBLIC globally by default.
alter default privileges for role postgres revoke all on functions from public;
alter default privileges for role postgres in schema public revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from public, anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from public, anon, authenticated;
alter default privileges for role postgres in schema app revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema app revoke all on sequences from public, anon, authenticated;
alter default privileges for role postgres in schema app revoke all on functions from public, anon, authenticated;

create function app.is_active_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as p
    where p.id = auth.uid() and p.active
  )
$$;

create function app.my_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles as p
  where p.id = auth.uid() and p.active
$$;

revoke all on function app.is_active_member(), app.my_role() from public, anon, authenticated;
grant usage on schema app to authenticated;
grant execute on function app.is_active_member(), app.my_role() to authenticated;

alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.topics enable row level security;
alter table public.votes enable row level security;
alter table public.comments enable row level security;
alter table public.events enable row level security;
alter table public.checks enable row level security;
alter table public.sources enable row level security;
alter table public.corrections enable row level security;
alter table public.invites enable row level security;

create policy profiles_read on public.profiles for select to authenticated
  using ((id = (select auth.uid()) and (select app.is_active_member())) or (select app.my_role()) = 'manutentore');
create policy settings_read on public.settings for select to authenticated using ((select app.is_active_member()));
create policy topics_read on public.topics for select to authenticated using ((select app.is_active_member()));
create policy votes_read on public.votes for select to authenticated using ((select app.is_active_member()));
create policy comments_read on public.comments for select to authenticated using ((select app.is_active_member()));
create policy events_read on public.events for select to authenticated using ((select app.is_active_member()));
create policy checks_read on public.checks for select to authenticated using ((select app.is_active_member()));
create policy sources_read on public.sources for select to authenticated using ((select app.is_active_member()));
create policy corrections_read on public.corrections for select to authenticated using ((select app.is_active_member()));
create policy invites_read on public.invites for select to authenticated using ((select app.my_role()) in ('manutentore', 'decisore'));

revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;
grant select on public.profiles, public.settings, public.topics, public.votes,
  public.comments, public.events, public.checks, public.sources,
  public.corrections to authenticated;
grant select (id, email, role, invited_by, display_name_hint, expires_at,
  used_at, revoked_at, created_at) on public.invites to authenticated;

create view public.people with (security_invoker = false) as
  select p.id, p.display_name, p.role, p.active
  from public.profiles as p
  where p.role <> 'manutentore' and (select app.is_active_member());

revoke all on public.people from public, anon, authenticated;
grant select on public.people to authenticated;
