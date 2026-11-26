-- Coaching methodology (Level Books, junior modules, drills...) lives behind the login,
-- not in a public file. Run once in the Supabase SQL editor, after 01-schema.sql.
create table if not exists public.content (
  key        text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.content enable row level security;
drop policy if exists content_read  on public.content;
create policy content_read  on public.content for select to authenticated using (public.is_coach());
drop policy if exists content_admin on public.content;
create policy content_admin on public.content for all    to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.content from anon;
