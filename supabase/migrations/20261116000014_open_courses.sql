-- Students can open and skip any lesson or chapter: no sequential locking anymore.
update public.courses set sequential = false;
alter table public.courses alter column sequential set default false;
