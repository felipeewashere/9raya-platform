-- Storage buckets
--   resources: course PDFs and supporting files. Signed-in users can read; admins write.
--   avatars:   profile pictures. Public read; each user writes only inside their own folder "<uid>/...".
--   imports:   PDFs uploaded for the import/review workflow. Admins only.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('resources', 'resources', false, 52428800, null),
  ('avatars', 'avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp']),
  ('imports', 'imports', false, 52428800, array['application/pdf'])
on conflict (id) do nothing;

create policy "resources: signed-in read" on storage.objects for select to authenticated
  using (bucket_id = 'resources');
create policy "resources: admin write" on storage.objects for all to authenticated
  using (bucket_id = 'resources' and public.is_admin())
  with check (bucket_id = 'resources' and public.is_admin());

create policy "avatars: public read" on storage.objects for select to anon, authenticated
  using (bucket_id = 'avatars');
create policy "avatars: own folder insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: own folder update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: own folder delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "imports: admin only" on storage.objects for all to authenticated
  using (bucket_id = 'imports' and public.is_admin())
  with check (bucket_id = 'imports' and public.is_admin());
