-- Where the student is: year (AP1 for now), section and TD group (used for the timetable).
-- AP1: section 1 = G1..G4, section 2 = G5..G6.
alter table public.profiles
  add column study_year text check (study_year in ('AP1', 'AP2', 'CI1', 'CI2', 'CI3')),
  add column section smallint check (section between 1 and 9),
  add column group_code text check (group_code ~ '^G[1-9]$'),
  add constraint profiles_ap1_group check (
    study_year is distinct from 'AP1'
    or section is null
    or (section = 1 and group_code in ('G1', 'G2', 'G3', 'G4'))
    or (section = 2 and group_code in ('G5', 'G6'))
  );

grant update (study_year, section, group_code) on public.profiles to authenticated;
