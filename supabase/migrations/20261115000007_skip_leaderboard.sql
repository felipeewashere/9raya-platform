-- 1) Skipping lessons: a skipped lesson counts as done (progress, chapter unlocking) but earns no XP.
--    It does not count for "lessons completed" achievements nor for chapter/course XP bonuses.
--    Passing the quiz later turns it into a real completion (skipped = false).
alter table public.lesson_progress add column if not exists skipped boolean not null default false;

create or replace function public.evaluate_achievements(p_user uuid)
returns setof text language plpgsql security definer set search_path = public
as $$
declare
  s record;
  lessons_done integer;
  correct_total integer;
  run integer;
  chapters_done integer;
  courses_done integer;
  total_xp integer;
  earned text[] := '{}';
  a text;
begin
  select * into s from public.get_streak(p_user);
  select count(*) into lessons_done from public.lesson_progress where user_id = p_user and status = 'completed' and not skipped;
  select count(*) into correct_total from public.answer_events where user_id = p_user and correct;
  run := public.best_correct_run(p_user);
  select count(*) into chapters_done from public.xp_events where user_id = p_user and reason = 'chapter_complete';
  select count(*) into courses_done from public.xp_events where user_id = p_user and reason = 'course_complete';
  select coalesce(sum(amount), 0) into total_xp from public.xp_events where user_id = p_user;

  if lessons_done >= 1 then earned := array_append(earned, 'first-lesson'); end if;
  if run >= 5 then earned := array_append(earned, 'streak-5-correct'); end if;
  if s.longest_streak >= 3 then earned := array_append(earned, 'days-3'); end if;
  if s.longest_streak >= 7 then earned := array_append(earned, 'days-7'); end if;
  if s.longest_streak >= 30 then earned := array_append(earned, 'days-30'); end if;
  if chapters_done >= 1 then earned := array_append(earned, 'first-chapter'); end if;
  if courses_done >= 1 then earned := array_append(earned, 'first-course'); end if;
  if correct_total >= 100 then earned := array_append(earned, 'questions-100'); end if;
  if lessons_done >= 10 then earned := array_append(earned, 'lessons-10'); end if;
  if total_xp >= 1000 then earned := array_append(earned, 'xp-1000'); end if;

  foreach a in array earned loop
    insert into public.user_achievements (user_id, achievement_id) values (p_user, a)
    on conflict do nothing;
    if found then return next a; end if;
  end loop;
end;
$$;
revoke execute on function public.evaluate_achievements(uuid) from public, anon, authenticated;
grant execute on function public.evaluate_achievements(uuid) to service_role;

-- 2) Leaderboard: XP and passed quizzes for a period ('jour' = today, 'semaine' = since Monday,
--    anything else = all time), in Moroccan time. Returns the top p_limit plus the caller's own row.
--    Only public profile fields (username, avatar) are exposed.
create or replace function public.leaderboard(p_period text default 'tout', p_limit integer default 50)
returns table (rank bigint, user_id uuid, username text, avatar_url text, xp integer, quizzes integer, is_me boolean)
language sql stable security definer set search_path = public
as $$
  with bounds as (
    select case p_period
      when 'jour' then (date_trunc('day', now() at time zone 'Africa/Casablanca') at time zone 'Africa/Casablanca')
      when 'semaine' then (date_trunc('week', now() at time zone 'Africa/Casablanca') at time zone 'Africa/Casablanca')
      else '-infinity'::timestamptz
    end as since
  ),
  x as (
    select e.user_id, sum(e.amount)::integer as xp
    from public.xp_events e, bounds b
    where e.created_at >= b.since
    group by e.user_id
  ),
  q as (
    select a.user_id, count(*)::integer as quizzes
    from public.quiz_attempts a, bounds b
    where a.status = 'finished' and a.passed and a.finished_at >= b.since
    group by a.user_id
  ),
  ranked as (
    select rank() over (order by coalesce(x.xp, 0) desc, coalesce(q.quizzes, 0) desc) as rank,
           p.id as user_id, p.username, p.avatar_url,
           coalesce(x.xp, 0) as xp, coalesce(q.quizzes, 0) as quizzes,
           p.id = auth.uid() as is_me
    from public.profiles p
    left join x on x.user_id = p.id
    left join q on q.user_id = p.id
    where coalesce(x.xp, 0) > 0 or p.id = auth.uid()
  )
  select * from ranked
  where rank <= greatest(1, least(p_limit, 200)) or is_me
  order by rank, username;
$$;
revoke execute on function public.leaderboard(text, integer) from public, anon;
grant execute on function public.leaderboard(text, integer) to authenticated;

create index if not exists xp_events_created_idx on public.xp_events (created_at);
create index if not exists quiz_attempts_finished_idx on public.quiz_attempts (finished_at) where status = 'finished';
