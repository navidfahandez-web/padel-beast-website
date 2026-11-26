-- Padel Beast Coach Portal: Postgres schema for Supabase
-- Run once in the Supabase SQL editor (or as a migration).
-- Every table has row-level security: only ACTIVE coaches can read/write; only admins can delete.

create extension if not exists pgcrypto;

-- ───────── Coaches (one row per login) ─────────
create table if not exists public.coaches (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  name       text not null,
  email      text not null,
  role       text not null default 'coach' check (role in ('admin','coach')),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function public.is_coach() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.coaches where user_id = auth.uid() and active)
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.coaches where user_id = auth.uid() and active and role = 'admin')
$$;

create or replace function public.touch_updated() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

-- ───────── Players ─────────
create table if not exists public.players (
  id            text primary key default gen_random_uuid()::text,
  name          text not null,
  level         int  not null default 1 check (level between 1 and 4),
  program       text not null default 'Private VIP',  -- Private VIP | Progress Plan | Group academy | Junior programme | Match Report client
  junior_group  text check (junior_group in ('A','B','C')),
  main_coach    text,                                  -- free text; juniors rotate coaches, so usually null
  side          text,                                  -- Drive (right) | Revés (left) | Both
  hand          text,                                  -- Right | Left
  start_date    date,
  goal          text,
  health_notes  text,                                  -- injuries / medical / allergies (sensitive)
  dob           date,                                  -- juniors (sensitive)
  school        text,
  parent_name   text,                                  -- sensitive
  parent_phone  text,                                  -- sensitive
  kit_size      text,
  milestones    jsonb not null default '{}'::jsonb,   -- keys: '<level>_<index>' for adults (e.g. '2_0'), 'jr_<0..5>' for junior modules → true/false
  level_history jsonb not null default '[]'::jsonb,   -- [{date, from, to}]
  is_sample     boolean not null default false,
  archived      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_by    uuid
);

-- ───────── Lessons (one per lesson taught) ─────────
create table if not exists public.lessons (
  id          text primary key default gen_random_uuid()::text,
  date        date not null,
  coach_id    uuid references public.coaches(user_id) on delete set null,
  coach_name  text not null,                           -- kept as text so history survives coach removal
  group_code  text check (group_code in ('A','B','C','mixed','adult')),
  module      int  check (module between 0 and 5),     -- 0 = Oct Fundamentals … 5 = Mar Match Play; null = not a junior module
  training    text check (training ~ '^T[1-8]$'),
  focus       text,
  objectives  text,
  summary     text not null default '',               -- "What we did in the lesson"
  exercises   jsonb not null default '[]'::jsonb,     -- [{name, min, obj}] up to 5
  is_sample   boolean not null default false,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);
create index if not exists lessons_date_idx  on public.lessons (date desc);
create index if not exists lessons_group_idx on public.lessons (group_code, date desc);

-- ───────── Personal report per player per lesson ─────────
create table if not exists public.lesson_feedback (
  lesson_id   text not null references public.lessons(id) on delete cascade,
  player_id   text not null references public.players(id) on delete cascade,
  attendance  text not null default 'Present' check (attendance in ('Present','Late','Absent')),
  rating      int  not null default 0 check (rating between 0 and 5),   -- 0 = not rated
  comment     text,
  improve     text,
  next_focus  text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid,
  primary key (lesson_id, player_id)
);
create index if not exists feedback_player_idx on public.lesson_feedback (player_id);

-- ───────── Progress reports (deeper review every few weeks) ─────────
create table if not exists public.progress_reports (
  id            text primary key default gen_random_uuid()::text,
  player_id     text not null references public.players(id) on delete cascade,
  date          date not null,
  type          text,
  coach_name    text,
  pillars       jsonb not null default '{}'::jsonb,   -- {position, placement, decision, technique, durability} 1–10
  match         jsonb not null default '{}'::jsonb,   -- {errors, optimal, back, rally} numbers or null
  strengths     text,
  improve       jsonb not null default '[]'::jsonb,   -- ["area", …]
  improve_notes text,
  next_focus    text,
  homework      text,
  injury        text,
  is_sample     boolean not null default false,
  created_by    uuid default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_by    uuid
);
create index if not exists reports_player_idx on public.progress_reports (player_id, date);

-- ───────── Objectives and tournaments ─────────
create table if not exists public.objectives (
  id              text primary key default gen_random_uuid()::text,
  player_id       text not null references public.players(id) on delete cascade,
  kind            text not null check (kind in ('Technique','Match data','Fitness & durability','Level test','Tournament')),
  title           text not null,
  target          text,
  due             date,
  status          text not null default 'Open',  -- Open | In progress | Achieved | Missed ; Tournament: Planned | Registered | Played | Withdrew
  tournament_date date,
  category        text,
  partner         text,
  result          text default '—',
  is_sample       boolean not null default false,
  created_by      uuid default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  updated_by      uuid
);

-- ───────── Session plans (junior programme) ─────────
create table if not exists public.session_plans (
  id              text primary key,             -- 'M2T3' = module index 1, T3
  module          int  not null check (module between 0 and 5),
  training        text not null check (training ~ '^T[1-8]$'),
  objectives      text,
  exercises       jsonb not null default '[]'::jsonb,
  updated_by_name text,
  updated_at      timestamptz not null default now(),
  updated_by      uuid
);

-- ───────── updated_at / updated_by triggers ─────────
do $$
declare t text;
begin
  foreach t in array array['players','lessons','lesson_feedback','progress_reports','objectives','session_plans'] loop
    execute format('drop trigger if exists trg_touch on public.%I', t);
    execute format('create trigger trg_touch before update on public.%I for each row execute function public.touch_updated()', t);
  end loop;
end $$;

-- ───────── Row-level security ─────────
alter table public.coaches          enable row level security;
alter table public.players          enable row level security;
alter table public.lessons          enable row level security;
alter table public.lesson_feedback  enable row level security;
alter table public.progress_reports enable row level security;
alter table public.objectives       enable row level security;
alter table public.session_plans    enable row level security;

-- coaches: every active coach can see the team list; only admins manage it
drop policy if exists coaches_read on public.coaches;
create policy coaches_read  on public.coaches for select to authenticated using (public.is_coach());
drop policy if exists coaches_admin on public.coaches;
create policy coaches_admin on public.coaches for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- data tables: active coaches read/insert/update; admins delete
do $$
declare t text;
begin
  foreach t in array array['players','lessons','lesson_feedback','progress_reports','objectives','session_plans'] loop
    execute format('drop policy if exists %1$s_read on public.%1$I', t);
    execute format('create policy %1$s_read on public.%1$I for select to authenticated using (public.is_coach())', t);
    execute format('drop policy if exists %1$s_insert on public.%1$I', t);
    execute format('create policy %1$s_insert on public.%1$I for insert to authenticated with check (public.is_coach())', t);
    execute format('drop policy if exists %1$s_update on public.%1$I', t);
    execute format('create policy %1$s_update on public.%1$I for update to authenticated using (public.is_coach()) with check (public.is_coach())', t);
    execute format('drop policy if exists %1$s_delete on public.%1$I', t);
    execute format('create policy %1$s_delete on public.%1$I for delete to authenticated using (public.is_admin())', t);
  end loop;
end $$;

-- Coaches may remove a player from a lesson they are editing (deleting a feedback row)
drop policy if exists lesson_feedback_delete on public.lesson_feedback;
create policy lesson_feedback_delete on public.lesson_feedback for delete to authenticated using (public.is_coach());

-- Nothing is readable by anonymous visitors.
revoke all on all tables in schema public from anon;
