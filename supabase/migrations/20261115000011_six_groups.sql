-- Each AP1 section has groups G1..G6 (student's correction): a group is identified by (section, group).
alter table public.profiles drop constraint profiles_ap1_group;
alter table public.profiles add constraint profiles_ap1_group check (
  study_year is distinct from 'AP1'
  or section is null
  or (section in (1, 2) and group_code in ('G1', 'G2', 'G3', 'G4', 'G5', 'G6'))
);
