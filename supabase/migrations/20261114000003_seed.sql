-- Reference data. Course content (chapters, lessons, quizzes) is imported from
-- content/<course>/chNN.json with `npm run content:import`.

insert into public.achievements (id, title, description, icon, xp_reward, position) values
  ('first-lesson',     'Premier cours terminé',               'Termine ta première leçon.',                       'book-open-check', 0, 1),
  ('streak-5-correct', 'Première série de 5 bonnes réponses', 'Réponds juste 5 fois d''affilée.',                 'zap',             0, 2),
  ('days-3',           '3 jours consécutifs',                 'Étudie 3 jours de suite.',                         'flame',           0, 3),
  ('days-7',           '7 jours consécutifs',                 'Étudie 7 jours de suite.',                         'flame-kindling',  0, 4),
  ('first-chapter',    'Premier chapitre terminé',            'Termine toutes les leçons d''un chapitre.',        'trophy',          0, 5),
  ('questions-100',    '100 questions réussies',              'Réponds juste à 100 questions.',                   'target',          0, 6),
  ('lessons-10',       '10 leçons terminées',                 'Termine 10 leçons.',                               'library',         0, 7),
  ('xp-1000',          '1000 XP',                             'Gagne 1000 points d''expérience.',                 'star',            0, 8),
  ('days-30',          '30 jours consécutifs',                'Étudie 30 jours de suite.',                        'crown',           0, 9),
  ('first-course',     'Premier module terminé',              'Termine toutes les leçons d''un module.',          'graduation-cap',  0, 10)
on conflict (id) do update set title = excluded.title, description = excluded.description, icon = excluded.icon, position = excluded.position;

insert into public.semesters (slug, title, description, position, published) values
  ('s1', 'Semestre 1', 'Premier semestre — modules fondamentaux.', 1, true),
  ('s2', 'Semestre 2', 'Deuxième semestre.', 2, false)
on conflict (slug) do nothing;

insert into public.courses (semester_id, slug, title, short_title, description, color, status, position)
select s.id, v.slug, v.title, v.short_title, v.description, v.color, v.status::public.content_status, v.position
from public.semesters s
cross join (values
  ('algebre-1', 'Algèbre 1', 'Algèbre', 'Structures algébriques, espaces vectoriels, dimension et rang, matrices, polynômes et fractions rationnelles.', '#2563EB', 'published', 1),
  ('analyse-1', 'Analyse 1', 'Analyse', 'Nombres réels, suites, fonctions, limites, continuité et dérivation.', '#0EA5E9', 'coming_soon', 2),
  ('mecanique-du-point', 'Mécanique du point', 'Mécanique', 'Cinématique, dynamique, énergie et oscillateurs, forces centrales.', '#16A34A', 'coming_soon', 3)
) as v(slug, title, short_title, description, color, status, position)
where s.slug = 's1'
on conflict (slug) do nothing;
