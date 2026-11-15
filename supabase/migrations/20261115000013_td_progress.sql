-- TD exercises: the student marks each one "réussi" (done) or "à revoir" (review).
create table public.td_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  course_slug text not null check (course_slug ~ '^[a-z0-9-]+$'),
  chapter smallint not null check (chapter between 1 and 99),
  exercise text not null check (char_length(exercise) between 1 and 40),
  status text not null check (status in ('done', 'review')),
  updated_at timestamptz not null default now(),
  primary key (user_id, course_slug, chapter, exercise)
);

alter table public.td_progress enable row level security;
create policy "td: read own" on public.td_progress for select to authenticated using (user_id = (select auth.uid()));
create policy "td: insert own" on public.td_progress for insert to authenticated with check (user_id = (select auth.uid()));
create policy "td: update own" on public.td_progress for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "td: delete own" on public.td_progress for delete to authenticated using (user_id = (select auth.uid()));
grant select, insert, update, delete on public.td_progress to authenticated;
