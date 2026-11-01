-- gen_random_uuid() is built into recent PostgreSQL versions. Install pgcrypto
-- where available (Supabase), while allowing PGlite to use the built-in form.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pgcrypto') then
    create extension if not exists pgcrypto;
  end if;
end
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  display_name text not null,
  email text not null unique,
  role text not null check (role in ('manutentore', 'decisore', 'membro')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.settings (
  id integer primary key check (id = 1),
  decision_rule text not null default 'unanimita' check (decision_rule in ('unanimita', 'maggioranza')),
  stale_days integer not null default 4 check (stale_days > 0)
);

insert into public.settings (id) values (1);

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 280),
  body text check (char_length(body) <= 4000),
  link_url text check (link_url ~ '^https://'),
  link_title text,
  link_site text,
  format text check (format in ('fonte_alla_mano', 'a_caldo', 'non_ti_hanno_detto', 'fuorigioco')),
  stage text not null default 'da_decidere' check (stage in ('da_decidere', 'verifica', 'legale', 'pubblicato', 'parcheggiato')),
  round integer not null default 1 check (round >= 1),
  proposed_by uuid not null references public.profiles(id) on delete restrict,
  writer_id uuid references public.profiles(id) on delete restrict,
  reviewer_id uuid references public.profiles(id) on delete restrict,
  constraint topics_distinct_writer_reviewer check (writer_id <> reviewer_id),
  review_approved_by uuid references public.profiles(id) on delete restrict,
  review_approved_at timestamptz,
  post_url text check (post_url ~ '^https://'),
  decided_at timestamptz,
  published_at timestamptz,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index topics_stage_last_activity_at_idx on public.topics (stage, last_activity_at);

create table public.votes (
  topic_id uuid not null references public.topics(id) on delete cascade,
  voter_id uuid not null references public.profiles(id) on delete restrict,
  round integer not null check (round >= 1),
  value boolean not null,
  updated_at timestamptz not null default now(),
  primary key (topic_id, voter_id, round)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete restrict,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create table public.events (
  id bigserial primary key,
  topic_id uuid references public.topics(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete restrict,
  kind text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.checks (
  topic_id uuid not null references public.topics(id) on delete cascade,
  kind text not null check (kind in ('verifica', 'legale')),
  item text not null,
  done_by uuid not null references public.profiles(id) on delete restrict,
  done_at timestamptz not null default now(),
  primary key (topic_id, kind, item),
  constraint checks_item_matches_kind check (
    (kind = 'verifica' and item in ('isolare', 'fonte_primaria', 'lettura_intera', 'secondo_riscontro', 'controllo_legale'))
    or (kind = 'legale' and item in ('diffamazione', 'continenza', 'gdpr_minori', 'copyright', 'rettifica'))
  )
);

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  title text not null,
  url text not null check (url ~ '^https://'),
  kind text not null check (kind in ('primaria', 'secondaria')),
  screenshot_path text,
  added_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.corrections (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  body text not null,
  reason text not null,
  new_post_url text check (new_post_url ~ '^https://'),
  author_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role text not null check (role in ('decisore', 'membro')),
  token_hash text not null unique,
  invited_by uuid not null references public.profiles(id) on delete restrict,
  display_name_hint text,
  expires_at timestamptz not null default now() + interval '7 days',
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
