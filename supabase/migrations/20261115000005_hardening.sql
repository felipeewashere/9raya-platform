-- Hardening after the Supabase security advisor.
-- Functions are executable by PUBLIC by default; restrict them to the roles that need them.
-- is_admin() stays executable by anon and authenticated on purpose: RLS policies (e.g. the
-- public course catalog) call it as the requesting role, and it simply returns false for them.

alter function public.touch_updated_at() set search_path = public;

-- trigger only
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- internal helper, only called from other SECURITY DEFINER functions
revoke execute on function public.user_local_day(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.user_local_day(uuid, timestamptz) to service_role;

-- signed-in only (each checks auth.uid() / is_admin() internally)
revoke execute on function public.my_streak() from public, anon;
revoke execute on function public.my_chapter_progress(uuid) from public, anon;
revoke execute on function public.admin_lesson_stats(uuid) from public, anon;
revoke execute on function public.admin_question_stats(uuid) from public, anon;
revoke execute on function public.admin_students() from public, anon;
grant execute on function public.my_streak() to authenticated;
grant execute on function public.my_chapter_progress(uuid) to authenticated;
grant execute on function public.admin_lesson_stats(uuid) to authenticated;
grant execute on function public.admin_question_stats(uuid) to authenticated;
grant execute on function public.admin_students() to authenticated;
