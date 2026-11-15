-- 9raya learning platform — core schema
-- Hierarchy: semesters → courses → chapters → sections → lessons → lesson_blocks / questions
-- Security model:
--   * Content is readable by signed-in users when published (courses/semesters also by anon for the landing page).
--   * Correct answers live in question_answers, readable by admins only. Grading happens on the server.
--   * Progress, XP, streak and achievement rows are written only by the server (service role) through
--     SECURITY DEFINER functions whose EXECUTE is revoked from anon/authenticated. Students can read their own rows.

-- ------------------------------------------------------------------ enums
create type public.user_role as enum ('student', 'admin');
create type public.content_status as enum ('draft', 'published', 'coming_soon');
create type public.question_placement as enum ('quiz', 'checkpoint');
create type public.progress_status as enum ('in_progress', 'completed');
create type public.xp_reason as enum ('lesson_complete', 'quiz_pass', 'quiz_perfect', 'chapter_complete', 'course_complete', 'streak_day', 'checkpoint');

-- ------------------------------------------------------------------ profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique check (username ~ '^[a-zA-Z0-9_.-]{3,24}$'),
  full_name text check (char_length(full_name) <= 80),
  avatar_url text,
  role public.user_role not null default 'student',
  timezone text not null default 'Africa/Casablanca',
  daily_goal_xp integer not null default 30 check (daily_goal_xp between 10 and 200),
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------ content
create table public.semesters (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  title text not null,
  description text,
  position integer not null default 0,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.semesters (id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  title text not null,
  short_title text,
  description text,
  cover_url text,
  video_url text,
  color text not null default '#2563EB',
  status public.content_status not null default 'draft',
  -- when true, chapter k+1 unlocks once chapter k is at least half completed
  sequential boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index courses_semester_idx on public.courses (semester_id, position);

create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9-]+$'),
  number integer not null,
  title text not null,
  description text,
  video_url text,
  position integer not null default 0,
  published boolean not null default false,
  review_notes jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, slug)
);
create index chapters_course_idx on public.chapters (course_id, position);

create table public.sections (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9-]+$'),
  number text,
  title text not null,
  position integer not null default 0,
  unique (chapter_id, slug)
);
create index sections_chapter_idx on public.sections (chapter_id, position);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.sections (id) on delete cascade,
  -- denormalized for fast lookups and unique slugs per chapter
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9-]+$'),
  number text,
  title text not null,
  summary text,
  estimated_minutes integer not null default 8 check (estimated_minutes between 1 and 120),
  position integer not null default 0,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (chapter_id, slug)
);
create index lessons_section_idx on public.lessons (section_id, position);
create index lessons_chapter_idx on public.lessons (chapter_id);

create table public.lesson_blocks (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  position integer not null,
  type text not null,
  -- block payload; checkpoint blocks reference a question instead of embedding it
  data jsonb not null default '{}',
  origin text not null default 'source' check (origin in ('source', 'added')),
  question_id uuid,
  unique (lesson_id, position) deferrable initially deferred
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  -- stable identifier within the lesson (e.g. "quiz-3", "cp-1") so re-imports update in place
  -- and students' answer history is preserved
  key text not null,
  placement public.question_placement not null,
  position integer not null default 0,
  kind text not null check (kind in ('mcq', 'true_false', 'fill_blank', 'matching', 'ordering', 'steps')),
  -- public part: prompt, options, items (shuffled), placeholders — never the answer
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lesson_id, key)
);
create index questions_lesson_idx on public.questions (lesson_id, placement, position);

alter table public.lesson_blocks
  add constraint lesson_blocks_question_fk foreign key (question_id) references public.questions (id) on delete set null;

-- secret part, admins only
create table public.question_answers (
  question_id uuid primary key references public.questions (id) on delete cascade,
  answer jsonb not null,
  explanation text not null
);

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  chapter_id uuid references public.chapters (id) on delete cascade,
  lesson_id uuid references public.lessons (id) on delete cascade,
  title text not null,
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);
create index resources_course_idx on public.resources (course_id);

-- PDF import workflow: an uploaded file + its extracted draft awaiting review
create table public.content_imports (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses (id) on delete set null,
  storage_path text not null,
  file_name text not null,
  extracted_text text,
  draft jsonb,
  status text not null default 'uploaded' check (status in ('uploaded', 'extracted', 'reviewed', 'published', 'failed')),
  error text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------ learner data
create table public.lesson_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  status public.progress_status not null default 'in_progress',
  last_block integer not null default 0,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
create index lesson_progress_user_idx on public.lesson_progress (user_id, updated_at desc);

-- A quiz attempt is opened on the server when the student starts the quiz. Each question's
-- FIRST graded answer is stored in `results` and cannot be changed afterwards, so seeing the
-- correction and re-answering does not improve the score. Finishing computes score and XP.
create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'finished')),
  score integer not null default 0 check (score >= 0),
  total integer not null check (total > 0),
  passed boolean not null default false,
  xp_awarded integer not null default 0,
  -- { "<question_id>": { "correct": bool, "given": any, "steps": [bool...] } }
  results jsonb not null default '{}',
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index quiz_attempts_user_idx on public.quiz_attempts (user_id, created_at desc);
create index quiz_attempts_lesson_idx on public.quiz_attempts (lesson_id);

-- every graded answer (quiz or checkpoint), for accuracy stats, achievements and analytics
create table public.answer_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  attempt_id uuid references public.quiz_attempts (id) on delete cascade,
  correct boolean not null,
  created_at timestamptz not null default now()
);
create index answer_events_user_idx on public.answer_events (user_id, created_at);
create index answer_events_question_idx on public.answer_events (question_id);

create table public.xp_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount integer not null check (amount > 0),
  reason public.xp_reason not null,
  -- what earned it (lesson id, chapter id, date...). Unique per user+reason: XP cannot be farmed.
  ref text not null,
  created_at timestamptz not null default now(),
  unique (user_id, reason, ref)
);
create index xp_events_user_idx on public.xp_events (user_id, created_at desc);

-- one row per user per local calendar day with meaningful activity
create table public.activity_days (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  xp integer not null default 0,
  lessons_completed integer not null default 0,
  questions_answered integer not null default 0,
  primary key (user_id, day)
);

create table public.bookmarks (
  user_id uuid not null references public.profiles (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  body text not null default '' check (char_length(body) <= 20000),
  updated_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);

create table public.achievements (
  id text primary key,
  title text not null,
  description text not null,
  icon text not null,
  xp_reward integer not null default 0,
  position integer not null default 0
);

create table public.user_achievements (
  user_id uuid not null references public.profiles (id) on delete cascade,
  achievement_id text not null references public.achievements (id) on delete cascade,
  earned_at timestamptz not null default now(),
  seen boolean not null default false,
  primary key (user_id, achievement_id)
);

-- ------------------------------------------------------------------ helpers
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger courses_touch before update on public.courses for each row execute function public.touch_updated_at();
create trigger chapters_touch before update on public.chapters for each row execute function public.touch_updated_at();
create trigger lessons_touch before update on public.lessons for each row execute function public.touch_updated_at();
create trigger questions_touch before update on public.questions for each row execute function public.touch_updated_at();
create trigger notes_touch before update on public.notes for each row execute function public.touch_updated_at();
create trigger imports_touch before update on public.content_imports for each row execute function public.touch_updated_at();

-- Create a profile for every new auth user (email or Google).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base text;
  candidate text;
  n integer := 0;
begin
  base := lower(regexp_replace(coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1), 'etudiant'), '[^a-zA-Z0-9_.-]', '', 'g'));
  if char_length(base) < 3 then base := base || 'etu'; end if;
  base := left(base, 18);
  candidate := base;
  while exists (select 1 from public.profiles where username = candidate) loop
    n := n + 1;
    candidate := base || n::text;
  end loop;
  insert into public.profiles (id, username, full_name, avatar_url)
  values (
    new.id,
    candidate,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------------ gamification (server only)

-- Local calendar day for a user, using their profile timezone.
create or replace function public.user_local_day(p_user uuid, p_at timestamptz default now())
returns date
language sql
stable
security definer
set search_path = public
as $$
  select (p_at at time zone coalesce((select timezone from public.profiles where id = p_user), 'Africa/Casablanca'))::date;
$$;

-- Current and longest streak, computed from activity_days.
-- The current streak counts consecutive active days ending today, or ending yesterday
-- (the student still has today to keep it alive).
create or replace function public.get_streak(p_user uuid)
returns table (current_streak integer, longest_streak integer, active_today boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  today date := public.user_local_day(p_user);
  d record;
  run integer := 0;
  best integer := 0;
  prev date := null;
  cur integer := 0;
  has_today boolean;
begin
  for d in select day from public.activity_days where user_id = p_user and xp > 0 order by day loop
    if prev is not null and d.day = prev + 1 then run := run + 1; else run := 1; end if;
    best := greatest(best, run);
    prev := d.day;
  end loop;
  has_today := exists (select 1 from public.activity_days where user_id = p_user and day = today and xp > 0);
  if prev is not null and (prev = today or prev = today - 1) then cur := run; end if;
  return query select cur, best, has_today;
end;
$$;

-- Award XP once per (user, reason, ref). Returns the amount actually awarded (0 if already earned).
-- Also records the day as active and grants the daily streak bonus the first time XP is earned that day.
create or replace function public.award_xp(p_user uuid, p_amount integer, p_reason public.xp_reason, p_ref text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted integer;
  today date := public.user_local_day(p_user);
  streak integer;
  bonus integer := 0;
begin
  if p_amount <= 0 then return 0; end if;
  insert into public.xp_events (user_id, amount, reason, ref)
  values (p_user, p_amount, p_reason, p_ref)
  on conflict (user_id, reason, ref) do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then return 0; end if;

  insert into public.activity_days (user_id, day, xp) values (p_user, today, p_amount)
  on conflict (user_id, day) do update set xp = public.activity_days.xp + excluded.xp;

  -- daily streak bonus: +5 XP the first time the student earns XP on a given local day,
  -- only when it continues a streak of at least 2 days
  if p_reason <> 'streak_day' then
    select current_streak into streak from public.get_streak(p_user);
    if streak >= 2 then
      bonus := public.award_xp(p_user, 5, 'streak_day', today::text);
    end if;
  end if;
  return p_amount + bonus;
end;
$$;

create or replace function public.bump_activity(p_user uuid, p_lessons integer, p_questions integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.activity_days (user_id, day, lessons_completed, questions_answered)
  values (p_user, public.user_local_day(p_user), p_lessons, p_questions)
  on conflict (user_id, day) do update
    set lessons_completed = public.activity_days.lessons_completed + excluded.lessons_completed,
        questions_answered = public.activity_days.questions_answered + excluded.questions_answered;
end;
$$;

-- Longest run of consecutive correct answers ever.
create or replace function public.best_correct_run(p_user uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  e record;
  run integer := 0;
  best integer := 0;
begin
  for e in select correct from public.answer_events where user_id = p_user order by created_at, id loop
    if e.correct then run := run + 1; best := greatest(best, run); else run := 0; end if;
  end loop;
  return best;
end;
$$;

-- Grant every achievement whose condition is now met. Returns the newly earned ids.
create or replace function public.evaluate_achievements(p_user uuid)
returns setof text
language plpgsql
security definer
set search_path = public
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
  select count(*) into lessons_done from public.lesson_progress where user_id = p_user and status = 'completed';
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

-- Course / chapter completion percentages for a user (used by dashboards and locking).
create or replace function public.chapter_progress(p_user uuid, p_course uuid)
returns table (chapter_id uuid, total_lessons integer, completed_lessons integer)
language sql
stable
security definer
set search_path = public
as $$
  select c.id,
         count(l.id)::integer,
         count(lp.lesson_id) filter (where lp.status = 'completed')::integer
  from public.chapters c
  left join public.lessons l on l.chapter_id = c.id and l.published
  left join public.lesson_progress lp on lp.lesson_id = l.id and lp.user_id = p_user
  where c.course_id = p_course and c.published
  group by c.id, c.position
  order by c.position;
$$;

-- ------------------------------------------------------------------ privileges
revoke execute on function public.award_xp(uuid, integer, public.xp_reason, text) from public, anon, authenticated;
revoke execute on function public.bump_activity(uuid, integer, integer) from public, anon, authenticated;
revoke execute on function public.evaluate_achievements(uuid) from public, anon, authenticated;
revoke execute on function public.best_correct_run(uuid) from public, anon, authenticated;
grant execute on function public.award_xp(uuid, integer, public.xp_reason, text) to service_role;
grant execute on function public.bump_activity(uuid, integer, integer) to service_role;
grant execute on function public.evaluate_achievements(uuid) to service_role;
grant execute on function public.best_correct_run(uuid) to service_role;

-- read helpers are safe for the signed-in user about themselves
create or replace function public.my_streak()
returns table (current_streak integer, longest_streak integer, active_today boolean)
language sql
stable
security definer
set search_path = public
as $$
  select * from public.get_streak(auth.uid());
$$;
revoke execute on function public.get_streak(uuid) from public, anon, authenticated;
grant execute on function public.get_streak(uuid) to service_role;
revoke execute on function public.chapter_progress(uuid, uuid) from public, anon;
grant execute on function public.my_streak() to authenticated;

create or replace function public.my_chapter_progress(p_course uuid)
returns table (chapter_id uuid, total_lessons integer, completed_lessons integer)
language sql
stable
security definer
set search_path = public
as $$
  select * from public.chapter_progress(auth.uid(), p_course);
$$;
grant execute on function public.my_chapter_progress(uuid) to authenticated;
revoke execute on function public.chapter_progress(uuid, uuid) from authenticated;
grant execute on function public.chapter_progress(uuid, uuid) to service_role;

-- ------------------------------------------------------------------ row level security
alter table public.profiles enable row level security;
alter table public.semesters enable row level security;
alter table public.courses enable row level security;
alter table public.chapters enable row level security;
alter table public.sections enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_blocks enable row level security;
alter table public.questions enable row level security;
alter table public.question_answers enable row level security;
alter table public.resources enable row level security;
alter table public.content_imports enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.answer_events enable row level security;
alter table public.xp_events enable row level security;
alter table public.activity_days enable row level security;
alter table public.bookmarks enable row level security;
alter table public.notes enable row level security;
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;

-- profiles: own row (+ admins see all). Only safe columns are updatable by the user (role is not).
create policy "profiles: read own" on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "profiles: update own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles: admin update" on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());
revoke update on public.profiles from authenticated;
grant update (username, full_name, avatar_url, timezone, daily_goal_xp, onboarded) on public.profiles to authenticated;

-- content: published rows readable; admins manage everything
create policy "semesters: read published" on public.semesters for select to anon, authenticated using (published or public.is_admin());
create policy "semesters: admin write" on public.semesters for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "courses: read visible" on public.courses for select to anon, authenticated
  using (status in ('published', 'coming_soon') or public.is_admin());
create policy "courses: admin write" on public.courses for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "chapters: read published" on public.chapters for select to authenticated
  using (public.is_admin() or (published and exists (select 1 from public.courses c where c.id = course_id and c.status = 'published')));
create policy "chapters: admin write" on public.chapters for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "sections: read" on public.sections for select to authenticated
  using (public.is_admin() or exists (select 1 from public.chapters c where c.id = chapter_id and c.published));
create policy "sections: admin write" on public.sections for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "lessons: read published" on public.lessons for select to authenticated
  using (public.is_admin() or (published and exists (select 1 from public.chapters c where c.id = chapter_id and c.published)));
create policy "lessons: admin write" on public.lessons for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "blocks: read" on public.lesson_blocks for select to authenticated
  using (public.is_admin() or exists (select 1 from public.lessons l where l.id = lesson_id and l.published));
create policy "blocks: admin write" on public.lesson_blocks for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "questions: read" on public.questions for select to authenticated
  using (public.is_admin() or exists (select 1 from public.lessons l where l.id = lesson_id and l.published));
create policy "questions: admin write" on public.questions for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "answers: admin only" on public.question_answers for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "resources: read" on public.resources for select to authenticated
  using (public.is_admin() or exists (select 1 from public.courses c where c.id = course_id and c.status = 'published'));
create policy "resources: admin write" on public.resources for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "imports: admin only" on public.content_imports for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- learner data: students read their own; admins read all; writes go through the server
create policy "progress: read own" on public.lesson_progress for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "attempts: read own" on public.quiz_attempts for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "answers events: read own" on public.answer_events for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "xp: read own" on public.xp_events for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "activity: read own" on public.activity_days for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "user achievements: read own" on public.user_achievements for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "user achievements: mark seen" on public.user_achievements for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on public.user_achievements from authenticated;
grant update (seen) on public.user_achievements to authenticated;

-- lesson position (not completion) can be saved by the student directly
create policy "progress: insert own position" on public.lesson_progress for insert to authenticated
  with check (user_id = auth.uid() and status = 'in_progress' and completed_at is null);
create policy "progress: update own position" on public.lesson_progress for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke insert, update on public.lesson_progress from authenticated;
grant insert (user_id, lesson_id, last_block) on public.lesson_progress to authenticated;
grant update (last_block, updated_at) on public.lesson_progress to authenticated;

create policy "bookmarks: own" on public.bookmarks for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notes: own" on public.notes for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "achievements: read" on public.achievements for select to anon, authenticated using (true);
create policy "achievements: admin write" on public.achievements for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------------ admin analytics
create or replace function public.admin_lesson_stats(p_course uuid)
returns table (lesson_id uuid, title text, chapter_number integer, started integer, completed integer, attempts integer, avg_score numeric, pass_rate numeric)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
  select l.id, l.title, c.number,
         (select count(*) from public.lesson_progress lp where lp.lesson_id = l.id)::integer,
         (select count(*) from public.lesson_progress lp where lp.lesson_id = l.id and lp.status = 'completed')::integer,
         (select count(*) from public.quiz_attempts qa where qa.lesson_id = l.id)::integer,
         (select round(avg(qa.score::numeric / qa.total) * 100, 1) from public.quiz_attempts qa where qa.lesson_id = l.id),
         (select round(avg(case when qa.passed then 1 else 0 end) * 100, 1) from public.quiz_attempts qa where qa.lesson_id = l.id)
  from public.lessons l
  join public.chapters c on c.id = l.chapter_id
  where c.course_id = p_course
  order by c.position, l.position;
end;
$$;

create or replace function public.admin_question_stats(p_lesson uuid)
returns table (question_id uuid, answered integer, correct_rate numeric)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
  select q.id, count(e.id)::integer, round(avg(case when e.correct then 1 else 0 end) * 100, 1)
  from public.questions q
  left join public.answer_events e on e.question_id = q.id
  where q.lesson_id = p_lesson
  group by q.id, q.position
  order by q.position;
end;
$$;

create or replace function public.admin_students()
returns table (id uuid, username text, full_name text, avatar_url text, created_at timestamptz, total_xp integer, lessons_completed integer, last_active date)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
  select p.id, p.username, p.full_name, p.avatar_url, p.created_at,
         coalesce((select sum(x.amount) from public.xp_events x where x.user_id = p.id), 0)::integer,
         (select count(*) from public.lesson_progress lp where lp.user_id = p.id and lp.status = 'completed')::integer,
         (select max(a.day) from public.activity_days a where a.user_id = p.id)
  from public.profiles p
  order by p.created_at desc;
end;
$$;
