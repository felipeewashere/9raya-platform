-- Admin area
--   media: course / chapter cover images and videos uploaded from the admin.
--          Public read (the URLs are embedded in pages); only admins write.
--   Analytics fixes: only FINISHED quiz attempts count. Attempts are opened when a student
--   starts a quiz, so counting every row inflated `attempts` and dragged `avg_score` and
--   `pass_rate` down with abandoned attempts (score 0, passed false).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('media', 'media', true, 209715200, array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'])
on conflict (id) do nothing;

create policy "media: public read" on storage.objects for select to anon, authenticated
  using (bucket_id = 'media');
create policy "media: admin write" on storage.objects for all to authenticated
  using (bucket_id = 'media' and public.is_admin())
  with check (bucket_id = 'media' and public.is_admin());

-- ------------------------------------------------------------------ analytics (finished attempts only)
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
         (select count(*) from public.quiz_attempts qa where qa.lesson_id = l.id and qa.status = 'finished')::integer,
         (select round(avg(qa.score::numeric / qa.total) * 100, 1) from public.quiz_attempts qa where qa.lesson_id = l.id and qa.status = 'finished'),
         (select round(avg(case when qa.passed then 1 else 0 end) * 100, 1) from public.quiz_attempts qa where qa.lesson_id = l.id and qa.status = 'finished')
  from public.lessons l
  join public.chapters c on c.id = l.chapter_id
  where c.course_id = p_course
  order by c.position, l.position;
end;
$$;

-- answer_events of quiz questions are only written when an attempt is finished; checkpoint
-- answers have no attempt. Guard anyway so an event tied to an unfinished attempt never counts.
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
  select q.id,
         count(e.id)::integer,
         round(avg(case when e.correct then 1 else 0 end) filter (where e.id is not null) * 100, 1)
  from public.questions q
  left join public.answer_events e
    on e.question_id = q.id
   and (e.attempt_id is null or exists (select 1 from public.quiz_attempts qa where qa.id = e.attempt_id and qa.status = 'finished'))
  where q.lesson_id = p_lesson
  group by q.id, q.placement, q.position
  order by q.placement, q.position;
end;
$$;
