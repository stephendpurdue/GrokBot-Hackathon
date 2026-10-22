create extension if not exists pgcrypto;

create table communities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null
);

create table members (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities(id) on delete cascade,
  display_name text not null,
  handle text not null,
  consent_intros boolean not null default false,
  offers text[] not null default '{}',
  wants text[] not null default '{}',
  builds text[] not null default '{}',
  talks text[] not null default '{}',
  links jsonb not null default '{}',
  unique (community_id, handle)
);

create table answers (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  question_key text not null check (question_key in ('building','wants','offers','talk')),
  question text not null,
  answer text not null,
  unique (member_id, question_key)
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  thread_id text not null,
  content text not null,
  created_at timestamptz not null
);

create table intros (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  member_a uuid not null references members(id) on delete cascade,
  member_b uuid not null references members(id) on delete cascade,
  score float not null,
  reasons jsonb not null,
  draft_message text not null,
  created_at timestamptz not null default now(),
  unique (week_start, member_a, member_b),
  check (member_a::text < member_b::text)
);

create table speaker_runs (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  created_at timestamptz not null default now()
);

create table speaker_picks (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references speaker_runs(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('member','public')),
  why text not null,
  evidence jsonb not null
);

create table attempts (
  id uuid primary key default gen_random_uuid(),
  run_kind text not null check (run_kind in ('intro','speaker','thread','source')),
  status text not null check (status in ('ok','skipped','error')),
  subject text not null,
  detail text not null,
  created_at timestamptz not null default now()
);

create table revives (
  id uuid primary key default gen_random_uuid(),
  thread_id text not null,
  draft_message text not null,
  created_at timestamptz not null default now()
);

alter table communities enable row level security;
alter table members enable row level security;
alter table answers enable row level security;
alter table messages enable row level security;
alter table intros enable row level security;
alter table speaker_runs enable row level security;
alter table speaker_picks enable row level security;
alter table attempts enable row level security;
alter table revives enable row level security;
