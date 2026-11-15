-- All AP1 S1 modules of the timetable get a card (the ones without content stay "coming soon"),
-- and every module gets its own card colour (used behind its motion graphic, light and dark mode).
insert into public.courses (semester_id, slug, title, short_title, description, color, status, position)
select s.id, v.slug, v.title, v.short_title, v.description, v.color, 'coming_soon', v.position
from public.semesters s
cross join (values
  ('electrostatique', 'Électrostatique', 'Électro', 'Champ et potentiel, théorème de Gauss, conducteurs et condensateurs.', '#6b3fd1', 4),
  ('algorithmique', 'Algorithmique', 'Algo', 'Codage, pseudo-code, conditions, boucles et tableaux.', '#0f766e', 5),
  ('entrepreneuriat', 'Entrepreneuriat', 'Entrepreneuriat', 'Entrepreneuriat et compétences digitales.', '#b7791f', 6)
) as v(slug, title, short_title, description, color, position)
where s.slug = 's1'
on conflict (slug) do nothing;

update public.courses set color = '#2b5fd9' where slug = 'algebre-1';
update public.courses set color = '#c8431f' where slug = 'analyse-1';
update public.courses set color = '#1f7a5a' where slug = 'mecanique-du-point';
