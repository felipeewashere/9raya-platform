-- Performance fixes from the Supabase advisor.
-- 1) Evaluate auth.uid() once per query instead of once per row: (select auth.uid()).
-- 2) Index foreign keys used in joins and cascades.

alter policy "profiles: read own" on public.profiles using (id = (select auth.uid()) or public.is_admin());
alter policy "profiles: update own" on public.profiles using (id = (select auth.uid())) with check (id = (select auth.uid()));
alter policy "progress: read own" on public.lesson_progress using (user_id = (select auth.uid()) or public.is_admin());
alter policy "progress: insert own position" on public.lesson_progress with check (user_id = (select auth.uid()) and status = 'in_progress' and completed_at is null);
alter policy "progress: update own position" on public.lesson_progress using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy "attempts: read own" on public.quiz_attempts using (user_id = (select auth.uid()) or public.is_admin());
alter policy "answers events: read own" on public.answer_events using (user_id = (select auth.uid()) or public.is_admin());
alter policy "xp: read own" on public.xp_events using (user_id = (select auth.uid()) or public.is_admin());
alter policy "activity: read own" on public.activity_days using (user_id = (select auth.uid()) or public.is_admin());
alter policy "user achievements: read own" on public.user_achievements using (user_id = (select auth.uid()) or public.is_admin());
alter policy "user achievements: mark seen" on public.user_achievements using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy "bookmarks: own" on public.bookmarks using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy "notes: own" on public.notes using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create index if not exists answer_events_attempt_idx on public.answer_events (attempt_id);
create index if not exists bookmarks_lesson_idx on public.bookmarks (lesson_id);
create index if not exists content_imports_course_idx on public.content_imports (course_id);
create index if not exists content_imports_created_by_idx on public.content_imports (created_by);
create index if not exists lesson_blocks_question_idx on public.lesson_blocks (question_id);
create index if not exists lesson_progress_lesson_idx on public.lesson_progress (lesson_id);
create index if not exists notes_lesson_idx on public.notes (lesson_id);
create index if not exists resources_chapter_idx on public.resources (chapter_id);
create index if not exists resources_lesson_idx on public.resources (lesson_id);
create index if not exists user_achievements_achievement_idx on public.user_achievements (achievement_id);
